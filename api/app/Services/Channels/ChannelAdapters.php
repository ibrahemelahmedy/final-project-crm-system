<?php

namespace App\Services\Channels;

use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Story 26 (WIS-22), Decision 3. Resolve adapters through
 * ChannelAdapters::for(), never from the container directly — this is a
 * plain match registry so a test can rebind one concrete class.
 */
class ChannelAdapters
{
    public function for(ChannelProvider $provider): InboundWebhookAdapter
    {
        return match ($provider) {
            ChannelProvider::WhatsappCloud => app(WhatsappCloudAdapter::class),
            ChannelProvider::TwilioSms => app(TwilioSmsAdapter::class),
            ChannelProvider::EmailWebhook => app(EmailWebhookAdapter::class),
            default => new NullInboundWebhookAdapter,
        };
    }
}

/**
 * Unreachable in production — the controller resolves ChannelProvider before
 * ChannelAdapters::for() is ever called — but a default arm must still never
 * throw (AppServiceProvider.php's rule about default arms).
 */
final class NullInboundWebhookAdapter implements InboundWebhookAdapter
{
    public function verify(Request $request, ChannelConnection $connection): bool
    {
        return false;
    }

    public function challenge(Request $request, ChannelConnection $connection): ?Response
    {
        return null;
    }

    public function parse(Request $request, ChannelConnection $connection): array
    {
        return [];
    }
}
