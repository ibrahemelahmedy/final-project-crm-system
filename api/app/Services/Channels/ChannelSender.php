<?php

namespace App\Services\Channels;

use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Services\Integrations\OutboundResponse;

/**
 * Story 26 (WIS-22), Decision 9. Implementations NEVER throw and NEVER put a
 * raw exception message into a returned or stored field. OutboundResponse is
 * reused verbatim, not re-invented.
 */
interface ChannelSender
{
    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse;
}
