<?php

namespace App\Services\Channels;

use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Services\Integrations\OutboundResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Story 26 (WIS-22), Decision 9. Twilio SMS send. */
class TwilioSmsSender implements ChannelSender
{
    public function __construct(private readonly ChannelHttpClient $http) {}

    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse
    {
        try {
            $authToken = $connection->secret;
        } catch (Throwable) {
            return OutboundResponse::transportFailure();
        }

        if ($authToken === null || $authToken === '') {
            return OutboundResponse::blocked('channels.error.no_credential');
        }

        $accountSid = $connection->config['account_sid'] ?? null;
        $fromNumber = $connection->config['from_number'] ?? null;

        if (! is_string($accountSid) || $accountSid === '' || ! is_string($fromNumber) || $fromNumber === '') {
            return OutboundResponse::blocked('channels.error.not_configured');
        }

        $baseUrl = (string) config('channels.providers.twilio_sms.base_url');
        $url = "{$baseUrl}/Accounts/{$accountSid}/Messages.json";

        $response = $this->http->post($url, [
            'From' => $fromNumber,
            'To' => $message->recipient,
            'Body' => $message->body,
        ], [], null, [$accountSid, $authToken], asForm: true);

        if ($response->ok) {
            try {
                $body = json_decode((string) $response->body, true, flags: JSON_THROW_ON_ERROR);
                $sid = $body['sid'] ?? null;

                if (is_string($sid)) {
                    $message->provider_message_id = $sid;
                }
            } catch (Throwable $e) {
                Log::warning('TwilioSmsSender could not parse a successful response', ['exception' => $e::class]);
            }
        }

        return $response;
    }
}
