<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Story 20 (WIS-20), Decision 1. Branding lives in Story 08's `settings`
 * table as two extra rows — NOT a new `organization_settings` table. These
 * two keys are deliberately absent from SystemSettings::definitions(), so
 * they stay invisible to GET/PATCH /api/admin/settings and SystemSettingsPage
 * keeps being a security-settings screen only.
 */
class OrganizationBranding
{
    public const PRIMARY_COLOR_KEY = 'branding.primary_color';

    public const LOGO_PATH_KEY = 'branding.logo_path';

    /**
     * @return array{primary_color: string|null, logo_path: string|null, logo_url: string|null, updated_at: string|null}
     */
    public function current(): array
    {
        $rows = Setting::query()
            ->whereIn('key', [self::PRIMARY_COLOR_KEY, self::LOGO_PATH_KEY])
            ->get()
            ->keyBy('key');

        $primaryColor = static::unwrap($rows->get(self::PRIMARY_COLOR_KEY)?->value);
        $logoPath = static::unwrap($rows->get(self::LOGO_PATH_KEY)?->value);

        $updatedAt = $rows->max('updated_at');

        return [
            'primary_color' => $primaryColor,
            'logo_path' => $logoPath,
            'logo_url' => $logoPath ? Storage::disk(config('branding.disk'))->url($logoPath) : null,
            'updated_at' => optional($updatedAt)->toJSON(),
        ];
    }

    /** Null clears the override and restores the token default. */
    public function setPrimaryColor(?string $hex, User $actor, Request $request, AuditTrail $audit): void
    {
        $this->write(self::PRIMARY_COLOR_KEY, $hex, 'Primary color', $actor, $request, $audit);
    }

    public function setLogoPath(?string $path, User $actor, Request $request, AuditTrail $audit): void
    {
        $this->write(self::LOGO_PATH_KEY, $path, 'Logo', $actor, $request, $audit);
    }

    private function write(string $key, mixed $value, string $label, User $actor, Request $request, AuditTrail $audit): void
    {
        DB::transaction(function () use ($key, $value, $label, $actor, $request, $audit) {
            $previous = static::unwrap(Setting::where('key', $key)->value('value'));

            // Writing the same value twice is not an event — mirrors
            // SystemSettings::update().
            if ($previous === $value) {
                return;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                // Wrapped in an array — SQLite's json column rejects a bare
                // scalar, and unwrap() reads it back the same way.
                ['value' => ['value' => $value], 'updated_by' => $actor->id],
            );

            $audit->record(AuditTrail::BRANDING_CHANGED, $actor, $request, [
                ...AuditTrail::target('branding', $key, $label),
                'from' => $previous,
                'to' => $value,
            ]);
        });
    }

    private static function unwrap(mixed $stored): mixed
    {
        if (is_array($stored) && array_key_exists('value', $stored)) {
            return $stored['value'];
        }

        return $stored;
    }
}
