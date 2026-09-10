<?php

namespace App\Services\Channels;

use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Services\Integrations\OutboundResponse;

/**
 * Story 26 (WIS-22), Decision 9. Resolve senders through
 * ChannelSenders::for(), never from the container directly.
 */
class ChannelSenders
{
    public function for(ChannelProvider $provider): ChannelSender
    {
        return match ($provider) {
            ChannelProvider::WhatsappCloud => app(WhatsappCloudSender::class),
            ChannelProvider::TwilioSms => app(TwilioSmsSender::class),
            ChannelProvider::EmailWebhook => app(MailChannelSender::class),
            default => new NullChannelSender,
        };
    }
}

/** Never throws — the `wisal_chat` provider (or any future unknown one) has no sender. */
final class NullChannelSender implements ChannelSender
{
    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse
    {
        return OutboundResponse::blocked('channels.error.no_provider');
    }
}
