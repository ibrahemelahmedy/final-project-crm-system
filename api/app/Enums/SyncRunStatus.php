<?php

namespace App\Enums;

/**
 * Story 25 (WIS-24), Decision 9.
 *
 * `partial` = the run finished but at least one record/message failed
 * (`records_failed > 0`). `failed` = the run itself aborted before it could
 * finish normally (guard rejection, bad payload, a transport failure on the
 * very first page).
 */
enum SyncRunStatus: string
{
    case Running = 'running';
    case Success = 'success';
    case Partial = 'partial';
    case Failed = 'failed';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
