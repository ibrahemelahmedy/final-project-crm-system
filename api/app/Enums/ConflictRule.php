<?php

namespace App\Enums;

/**
 * Story 25 (WIS-24), Decision 6 — "last-write-wins vs Wisal-wins" means
 * AUTHORITY, not chronology.
 *
 * A literal clock comparison needs a trustworthy remote `updated_at`. An
 * arbitrary ERP may not send one, may send it in an unknown timezone, and
 * cross-system clock skew makes the comparison unsafe even when it does. So:
 *
 * - RemoteWins (the default for any mapped field with no rule) — the ERP is
 *   authoritative: the mapped value always overwrites the local one.
 * - WisalWins — never overwrite a non-empty local value. If the local value
 *   is null or '', fill it; otherwise leave it and count the field as
 *   skipped in the run's tally reasoning.
 * - On create the rule is moot — nothing to conflict with, so every mapped
 *   field is written.
 * - A remote field that is absent or null in the record is never written,
 *   under either rule. Absence is not an instruction to blank a value.
 */
enum ConflictRule: string
{
    case RemoteWins = 'remote_wins';
    case WisalWins = 'wisal_wins';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }
}
