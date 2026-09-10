<?php

namespace App\Services\Channels;

use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Services\Integrations\OutboundResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 9. WhatsApp Cloud API text send. The 24-hour
 * customer-service window is documented, not engineered around — a
 * 470/131047-class rejection maps to rejected() and dead-letters with
 * channels.error.outside_window.
 */
class WhatsappCloudSender implements ChannelSender
{
    public function __construct(private readonly ChannelHttpClient $http) {}

    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse
    {
        try {
            $secret = $connection->secret;
        } catch (Throwable) {
            return OutboundResponse::transportFailure();
        }

        if ($secret === null || $secret === '') {
            return OutboundResponse::blocked('channels.error.no_credential');
        }

        $phoneNumberId = $connection->config['phone_number_id'] ?? null;

        if (! is_string($phoneNumberId) || $phoneNumberId === '') {
            return OutboundResponse::blocked('channels.error.not_configured');
        }

        $baseUrl = (string) config('channels.providers.whatsapp_cloud.base_url');
        $url = "{$baseUrl}/{$phoneNumberId}/messages";

        $response = $this->http->post($url, [
            'messaging_product' => 'whatsapp',
            'to' => $message->recipient,
            'type' => 'text',
            'text' => ['body' => $message->body],
        ], [], $secret);

        if ($response->ok) {
            try {
                $body = json_decode((string) $response->body, true, flags: JSON_THROW_ON_ERROR);
                $id = $body['messages'][0]['id'] ?? null;

                if (is_string($id)) {
                    $message->provider_message_id = $id;
                }
            } catch (Throwable $e) {
                Log::warning('WhatsappCloudSender could not parse a successful response', ['exception' => $e::class]);
            }

            return $response;
        }

        // A 470 / 131047-class rejection means a free-form reply outside the
        // 24-hour customer-service window. Permanent (blocked(), not
        // rejected()) so the dispatcher dead-letters it immediately with a
        // reason the agent can act on, rather than retrying a message Meta
        // will keep rejecting.
        if ($response->status === 470) {
            return OutboundResponse::blocked('channels.error.outside_window');
        }

        return $response;
    }
}
