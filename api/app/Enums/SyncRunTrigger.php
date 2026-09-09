<?php

namespace App\Enums;

/** Story 25 (WIS-24). Who started this sync_runs row. */
enum SyncRunTrigger: string
{
    case Scheduled = 'scheduled';
    case Manual = 'manual';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $t) => $t->value, self::cases());
    }
}
