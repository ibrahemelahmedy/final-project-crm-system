<?php

namespace App\Enums;

/** Story 25 (WIS-24). Both directions share the sync_runs table (Decision 9). */
enum SyncDirection: string
{
    case Inbound = 'inbound';
    case Outbound = 'outbound';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $d) => $d->value, self::cases());
    }
}
