<?php

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    SlaRule::factory()->forPriority(Priority::Normal->value, 1440, 80)->create();
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
});

it('derives channel categories from the Channel enum, sums to 100, and omits zero-count channels', function () {
    Ticket::factory()->count(3)->create(['channel' => Channel::Email->value, 'priority' => Priority::Normal->value]);
    Ticket::factory()->count(1)->create(['channel' => Channel::Whatsapp->value, 'priority' => Priority::Normal->value]);
    // No SMS / Web form / Live chat tickets at all.

    $res = $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();

    $items = collect($res->json('channels.items'));

    // Every channel present is a real Channel enum value.
    $validValues = collect(Channel::cases())->map->value;
    expect($items->pluck('channel')->every(fn ($c) => $validValues->contains($c)))->toBeTrue();

    // Zero-count channels are omitted, not shown at 0%.
    expect($items->pluck('channel'))->not->toContain('sms', 'web_form', 'chat');

    // Percentages sum to 100 within rounding.
    expect(round($items->sum('percent')))->toBe(100.0);

    // The label comes from the enum, and rows are ordered by count desc.
    expect($items->first()['channel'])->toBe('email');
    expect($items->first()['label'])->toBe('Email');
});
