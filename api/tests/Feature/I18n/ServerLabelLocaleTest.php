<?php

use App\Models\Ticket;
use App\Services\AuditTrail;
use App\Services\SystemSettings;
use Illuminate\Support\Facades\App;

/**
 * Story 28 (WIS-29), Decision 2. The non-enum server-side label maps —
 * AuditTrail::label(), SystemSettings::definitions(), Ticket::categoryLabel() —
 * must be locale-sensitive too, and must preserve their load-bearing
 * fallbacks (raw slug for an unknown audit event, localised "General" for an
 * unknown category).
 */
it('resolves every AuditTrail event label in both locales', function () {
    foreach (AuditTrail::events() as $event) {
        App::setLocale('en');
        $en = AuditTrail::label($event);

        App::setLocale('ar');
        $ar = AuditTrail::label($event);

        expect($en)->not->toContain('audit.');
        expect($ar)->not->toContain('audit.');
        expect($ar)->not->toBe($en, "audit.$event is identical in en and ar");
    }

    App::setLocale('en');
});

it('returns an unknown audit event verbatim, not a dotted key', function () {
    foreach (['en', 'ar'] as $locale) {
        App::setLocale($locale);
        expect(AuditTrail::label('something.not_registered'))->toBe('something.not_registered');
    }

    App::setLocale('en');
});

it('resolves every SystemSettings label and help in both locales', function () {
    foreach (SystemSettings::keys() as $key) {
        App::setLocale('en');
        $en = SystemSettings::definitions()[$key];

        App::setLocale('ar');
        $ar = SystemSettings::definitions()[$key];

        foreach (['label', 'help'] as $field) {
            expect($en[$field])->not->toContain('settings.');
            expect($ar[$field])->not->toContain('settings.');
            expect($ar[$field])->not->toBe($en[$field], "settings.$key.$field is identical in en and ar");
        }
    }

    App::setLocale('en');
});

it('resolves every ticket category label in both locales and localises an unknown one', function () {
    foreach (Ticket::CATEGORIES as $category) {
        App::setLocale('en');
        $en = Ticket::categoryLabel($category);

        App::setLocale('ar');
        $ar = Ticket::categoryLabel($category);

        expect($en)->not->toContain('enums.');
        expect($ar)->not->toContain('enums.');
        expect($ar)->not->toBe($en);
    }

    // Unknown category → the localised "General", matching the old default arm.
    App::setLocale('en');
    expect(Ticket::categoryLabel('not_a_category'))->toBe(Ticket::categoryLabel('general'));

    App::setLocale('ar');
    expect(Ticket::categoryLabel('not_a_category'))->toBe(Ticket::categoryLabel('general'));

    App::setLocale('en');
});
