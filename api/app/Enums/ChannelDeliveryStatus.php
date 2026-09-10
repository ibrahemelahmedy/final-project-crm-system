<?php

namespace App\Enums;

/** Story 26 (WIS-22). Mirrors App\Enums\OutboxStatus. */
enum ChannelDeliveryStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
    case Dead = 'dead';
}
