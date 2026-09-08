<?php

namespace App\Mail\Concerns;

use App\Services\OrganizationBranding;
use Throwable;

/**
 * Story 23 (WIS-27), Decision 9. Resolves the branded-layout view data —
 * locale, direction, accent colour, logo and wordmark — for both mailables.
 *
 * Branding is resolved here in a try/catch, never with a raw app(...) call
 * inside Blade: OrganizationBranding::current() queries the `settings` table
 * and a mail render must never 500 on a branding lookup (fresh install, the
 * Vercel deployment, or a console context with no database all return nulls).
 */
trait BrandsMail
{
    /** The accent used when the organisation has set no primary colour. */
    private const DEFAULT_ACCENT = '#0F172A';

    /**
     * @return array{locale: string, dir: string, primaryColor: string, logoUrl: string|null, appName: string}
     */
    protected function brandingViewData(): array
    {
        $locale = app()->getLocale();

        $branding = ['primary_color' => null, 'logo_url' => null];

        try {
            $branding = app(OrganizationBranding::class)->current();
        } catch (Throwable) {
            // Fall back to the null branding below.
        }

        return [
            'locale' => $locale,
            'dir' => $locale === 'ar' ? 'rtl' : 'ltr',
            'primaryColor' => $branding['primary_color'] ?: self::DEFAULT_ACCENT,
            'logoUrl' => $branding['logo_url'] ?: null,
            'appName' => (string) config('app.name', 'Wisal'),
        ];
    }
}
