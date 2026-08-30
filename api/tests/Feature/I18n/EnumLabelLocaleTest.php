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
