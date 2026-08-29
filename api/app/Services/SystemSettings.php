<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The catalogue of system configuration keys, their defaults, and their
 * validation rules (Story 08).
 *
 * The rules here are the authority. The client's copy of them in
 * SystemSettingsPage is a convenience only — a request that bypasses the SPA
 * is validated against exactly this definition.
 */
class SystemSettings
{
    /**
     * key => [label, type, rules, default, help]
     *
     * `password_min_length` has a floor of 8, not 0 — the acceptance criterion
     * is that a minimum length can never be set to 0, and Story 01's
     * Password::defaults() already enforces 8, so a lower floor here would put
     * the two in conflict.
     *
     * @return array<string, array{label: string, type: string, rules: array<int, mixed>, default: mixed, help: string}>
     */
    public static function definitions(): array
    {
        return [
            'password_min_length' => [
                'label' => 'Minimum password length',
                'type' => 'integer',
                'rules' => ['integer', 'min:8', 'max:128'],
                'default' => 8,
                'help' => 'Characters required in an internal user password. Cannot be lower than 8.',
            ],
            'password_expiry_days' => [
                'label' => 'Password expiry (days)',
                'type' => 'integer',
                'rules' => ['integer', 'min:0', 'max:3650'],
                'default' => 0,
                'help' => 'Days before a password must be changed. 0 disables expiry.',
            ],
            'session_timeout_minutes' => [
                'label' => 'Session timeout (minutes)',
                'type' => 'integer',
                'rules' => ['integer', 'min:5', 'max:10080'],
                'default' => 480,
                'help' => 'Idle minutes before a signed-in user is asked to sign in again.',
            ],
            'max_login_attempts' => [
                'label' => 'Maximum failed sign-in attempts',
                'type' => 'integer',
                'rules' => ['integer', 'min:1', 'max:20'],
                'default' => 5,
                'help' => 'Failed attempts per minute before an account is throttled.',
            ],
            'audit_log_retention_days' => [
                'label' => 'Audit log retention (days)',
                'type' => 'integer',
                'rules' => ['integer', 'min:30', 'max:3650'],
                'default' => 365,
                'help' => 'How long audit entries are kept. Never lower than 30 days.',
            ],
        ];
    }

    /** @return array<int, string> */
    public static function keys(): array
    {
        return array_keys(static::definitions());
    }

    /**
     * Validation rules keyed by the `settings.<key>` payload path, so a
     * FormRequest can merge them straight in.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(): array
    {
        $rules = [];

        foreach (static::definitions() as $key => $definition) {
            $rules['settings.'.$key] = array_merge(['sometimes'], $definition['rules']);
        }

        return $rules;
    }

    /**
     * Every setting, stored value or default, with its metadata.
     *
     * @return array<int, array{key: string, label: string, type: string, value: mixed, default: mixed, help: string, min: int|null, max: int|null, updated_at: string|null}>
     */
    public function all(): array
    {
        $stored = Setting::query()->pluck('value', 'key');
        $timestamps = Setting::query()->pluck('updated_at', 'key');

        $out = [];

        foreach (static::definitions() as $key => $definition) {
            $out[] = [
                'key' => $key,
                'label' => $definition['label'],
                'type' => $definition['type'],
                'value' => static::unwrap($stored[$key] ?? null, $definition['default']),
                'default' => $definition['default'],
                'help' => $definition['help'],
                'min' => static::bound($definition['rules'], 'min'),
                'max' => static::bound($definition['rules'], 'max'),
                'updated_at' => optional($timestamps[$key] ?? null)->toJSON(),
            ];
        }

        return $out;
    }

    public function get(string $key): mixed
    {
        $definition = static::definitions()[$key] ?? null;

        if ($definition === null) {
            return null;
        }

        $row = Setting::where('key', $key)->first();

        return static::unwrap($row?->value, $definition['default']);
    }

    /**
     * Persist a batch of validated settings. One audit row per key that
     * actually changed — writing the same value twice is not an event.
     *
     * @param  array<string, mixed>  $values
     * @return array<int, string> the keys that changed
     */
    public function update(array $values, User $actor, Request $request, AuditTrail $audit): array
    {
        $changed = [];

        DB::transaction(function () use ($values, $actor, $request, $audit, &$changed) {
            foreach ($values as $key => $value) {
                if (! array_key_exists($key, static::definitions())) {
                    continue;
                }

                $previous = $this->get($key);

                if ($previous === $value) {
                    continue;
                }

                Setting::updateOrCreate(
                    ['key' => $key],
                    // Wrapped in an array — SQLite's json column rejects a
                    // bare scalar, and the cast reads it back the same way.
                    ['value' => ['value' => $value], 'updated_by' => $actor->id],
                );

                $audit->record(AuditTrail::SETTING_CHANGED, $actor, $request, [
                    ...AuditTrail::target('setting', $key, static::definitions()[$key]['label']),
                    'from' => $previous,
                    'to' => $value,
                ]);

                $changed[] = $key;
            }
        });

        return $changed;
    }

    private static function unwrap(mixed $stored, mixed $default): mixed
    {
        if (is_array($stored) && array_key_exists('value', $stored)) {
            return $stored['value'];
        }

        return $stored ?? $default;
    }

    /** @param  array<int, mixed>  $rules */
    private static function bound(array $rules, string $name): ?int
    {
        foreach ($rules as $rule) {
            if (is_string($rule) && str_starts_with($rule, $name.':')) {
                return (int) substr($rule, strlen($name) + 1);
            }
        }

        return null;
    }
}
