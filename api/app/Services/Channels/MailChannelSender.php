<?php

namespace App\Services\Channels;

use App\Mail\ChannelReplyMail;
use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Services\Integrations\OutboundResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 9. Rides WIS-27's mailer — no new transport.
 * Records the generated Message-ID onto the caller's message so the NEXT
 * inbound In-Reply-To can match against it (Decision 6's email branch).
 */
class MailChannelSender implements ChannelSender
{
    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse
    {
        $domain = (string) config('channels.providers.email_webhook.domain');
        $generatedId = sprintf(
            'wisal-%d-%d-%s@%s',
            $message->ticket_id,
            $message->id,
            Str::random(12),
            $domain,
        );

        try {
            Mail::to($message->recipient)->send(new ChannelReplyMail($message, $generatedId));
        } catch (Throwable $e) {
            Log::warning('MailChannelSender transport failure', ['exception' => $e::class]);

            return OutboundResponse::transportFailure();
        }

        $message->provider_message_id = $generatedId;

        return OutboundResponse::success(200, '');
    }
}
