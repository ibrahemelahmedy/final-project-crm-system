<?php

namespace App\Enums;

/**
 * Story 25 (WIS-24). `dead` is the dead-letter state — either
 * `attempts >= max_attempts` was reached, or the attempt failed permanently
 * (a guard rejection or a non-retryable HTTP status, per Decision 3).
 */
enum OutboxStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
    case Dead = 'dead';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
