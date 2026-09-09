<?php

namespace App\Services\Integrations;

use App\Enums\ConflictRule;
use App\Enums\CustomerTier;
use App\Models\Customer;
use Illuminate\Support\Str;

/**
 * Story 25 (WIS-24), Decision 5 & Decision 6. The closed whitelist and the
 * mapper. No Eloquent writes here — it returns an array; CustomerPuller does
 * the writing through the model so the email/phone mutators run.
 */
final class SyncFieldMap
{
    /** The CLOSED set of Wisal fields an inbound sync may write. */
    public const FIELDS = ['name', 'email', 'phone', 'company', 'tier'];

    /** The map key that identifies the remote record. Not a conflict participant. */
    public const EXTERNAL_ID = 'external_id';

    /**
     * Reads a dot path out of an untrusted decoded record. Scalars only.
     * An array/object value is treated as absent. A bool/int/float is cast
     * to string. Trimmed; '' is treated as absent.
     */
    public static function read(array $record, string $path): ?string
    {
        $value = data_get($record, $path);

        if ($value === null || is_array($value)) {
            return null;
        }

        if (is_bool($value)) {
            $value = $value ? '1' : '0';
        }

        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        // Cap defensively so an over-long value never reaches a 191-char
        // column and collides after truncation.
        return Str::limit($value, 191, '');
    }

    /**
     * @param  array<string,string>  $map  inbound_field_map
     * @param  array<string,string>  $rules  conflict_rules
     * @return array{attributes: array<string,string>, warnings: array<int, array{field: string, reason_key: string}>}
     */
    public static function attributesFor(array $record, array $map, array $rules, ?Customer $existing): array
    {
        $attributes = [];
        $warnings = [];

        foreach (self::FIELDS as $field) {
            $path = $map[$field] ?? null;

            if (! is_string($path) || $path === '') {
                continue; // unmapped field, never written
            }

            $value = self::read($record, $path);

            if ($value === null) {
                continue; // absent or null remote field, never written
            }

            if ($field === 'tier' && ! in_array($value, CustomerTier::values(), true)) {
                $warnings[] = ['field' => 'tier', 'reason_key' => 'integrations.sync.error.bad_tier'];

                continue;
            }

            if ($field === 'email' && ! filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $warnings[] = ['field' => 'email', 'reason_key' => 'integrations.sync.error.bad_email'];

                continue;
            }

            if ($existing !== null) {
                $rule = ConflictRule::tryFrom($rules[$field] ?? '') ?? ConflictRule::RemoteWins;

                if ($rule === ConflictRule::WisalWins && filled($existing->{$field} ?? null)) {
                    continue; // never overwrite a non-empty local value
                }
            }

            $attributes[$field] = $value;
        }

        return ['attributes' => $attributes, 'warnings' => $warnings];
    }
}
