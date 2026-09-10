<?php

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\App;

uses(RefreshDatabase::class);

/**
 * `*_label` fields travel WITH their value on every resource, so the label is
 * resolved server-side. These assert both catalogues rather than only the
 * Arabic one — the English values are the strings the enums used to hard-code,
 * and a drift there silently changes every existing consumer.
 */
it('resolves every enum label in English', function () {
    App::setLocale('en');

    expect(Priority::Urgent->label())->toBe('Urgent');
    expect(TicketStatus::Pending->label())->toBe('Pending');
    expect(Channel::Whatsapp->label())->toBe('WhatsApp');
    expect(Channel::WebForm->label())->toBe('Web form');
    expect(UserRole::TeamLead->label())->toBe('Team Lead');
});

it('resolves every enum label in Arabic', function () {
    App::setLocale('ar');

    expect(Priority::Urgent->label())->toBe('عاجلة');
    expect(TicketStatus::Pending->label())->toBe('معلّقة');
    expect(Channel::Whatsapp->label())->toBe('واتساب');
    expect(UserRole::TeamLead->label())->toBe('قائد فريق');

    App::setLocale('en');
});

it('never leaves a label unresolved as a raw dotted key', function () {
    foreach (['en', 'ar'] as $locale) {
        App::setLocale($locale);

        foreach (Priority::cases() as $case) {
            expect($case->label())->not->toContain('enums.');
        }
        foreach (TicketStatus::cases() as $case) {
            expect($case->label())->not->toContain('enums.');
        }
        foreach (Channel::cases() as $case) {
            expect($case->label())->not->toContain('enums.');
        }
        foreach (UserRole::cases() as $case) {
            expect($case->label())->not->toContain('enums.');
        }
    }

    App::setLocale('en');
});

/**
 * Story 28 (WIS-29), Decision 2. The guard that would have caught the whole
 * bug: every enum in app/Enums with a public label() must resolve it through
 * __() — proven by the label DIFFERING between `en` and `ar` for every case,
 * and never leaking a raw `enums.` key. A hard-coded match() arm fails this.
 *
 * If a future enum legitimately needs an identical label in both locales, add
 * it to $exempt with a one-line reason rather than widening the assertion.
 */
it('resolves every app/Enums label() through the translator in both locales', function () {
    /** @var array<string, string> $exempt */
    $exempt = [];

    $files = glob(app_path('Enums/*.php'));
    $checked = 0;

    foreach ($files as $file) {
        $fqcn = 'App\\Enums\\'.basename($file, '.php');

        if (! enum_exists($fqcn)) {
            continue;
        }

        $reflection = new ReflectionEnum($fqcn);

        if (! $reflection->hasMethod('label')) {
            continue;
        }

        $method = $reflection->getMethod('label');

        if (! $method->isPublic() || $method->isStatic() || $method->getNumberOfRequiredParameters() > 0) {
            continue;
        }

        if (array_key_exists($fqcn, $exempt)) {
            continue;
        }

        $checked++;

        foreach ($fqcn::cases() as $case) {
            App::setLocale('en');
            $en = $case->label();

            App::setLocale('ar');
            $ar = $case->label();

            expect($en)->not->toContain('enums.');
            expect($ar)->not->toContain('enums.');
            expect($ar)->not->toBe(
                $en,
                "$fqcn::{$case->name}->label() is identical in en and ar — is it going through __()?"
            );
        }
    }

    App::setLocale('en');

    // Sanity: the scan actually found the enums (10 at time of writing).
    expect($checked)->toBeGreaterThanOrEqual(10);
});
