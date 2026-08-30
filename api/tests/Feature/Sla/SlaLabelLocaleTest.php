<?php

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The ON BREACH sentence is derived from four booleans, so the card cannot
 * translate it client-side. It must arrive already localised, driven by the
 * Accept-Language header SetLocale reads.
 */
beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('returns the breach action sentence in English by default', function () {
    SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'notify_on_breach' => true,
        'escalation_enabled' => true,
        'escalate_to_role' => UserRole::Administrator->value,
    ]);

    $this->asUser($this->admin)
        ->getJson('/api/sla-rules')
        ->assertOk()
        ->assertJsonPath('data.0.breach_action_label', 'Notify Team Lead + escalate to Administrator');
});

it('returns the breach action sentence in Arabic for an Arabic client', function () {
    SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'notify_on_breach' => true,
        'escalation_enabled' => false,
        'escalate_to_role' => null,
    ]);

    $this->asUser($this->admin)
        ->withHeader('Accept-Language', 'ar')
        ->getJson('/api/sla-rules')
        ->assertOk()
        ->assertJsonPath('data.0.breach_action_label', 'تنبيه قائد الفريق');
});

it('localises the no-escalation sentence too', function () {
    SlaRule::factory()->create([
        'priority' => Priority::Low->value,
        'notify_on_breach' => false,
        'escalation_enabled' => false,
    ]);

    $this->asUser($this->admin)
        ->withHeader('Accept-Language', 'ar')
        ->getJson('/api/sla-rules')
        ->assertOk()
        ->assertJsonPath('data.0.breach_action_label', 'بلا تصعيد');
});
