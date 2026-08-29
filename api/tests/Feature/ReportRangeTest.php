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

    // In range: created + resolved today, on the Email channel.
    $this->inRange = Ticket::factory()->create([
        'assigned_to' => $this->lead->id,
        'priority' => Priority::Normal->value,
        'channel' => Channel::Email->value,
        'status' => 'resolved',
    ]);
    $this->inRange->forceFill([
        'created_at' => now()->subDays(2),
        'first_response_at' => now()->subDays(2)->addMinutes(15),
        'resolved_at' => now()->subDay(),
    ])->save();

    // Out of range: everything 90 days ago, on the Live chat channel.
    $this->outOfRange = Ticket::factory()->create([
        'assigned_to' => $this->lead->id,
        'priority' => Priority::Normal->value,
        'channel' => Channel::Chat->value,
        'status' => 'resolved',
    ]);
    $this->outOfRange->forceFill([
        'created_at' => now()->subDays(90),
        'first_response_at' => now()->subDays(90)->addMinutes(15),
        'resolved_at' => now()->subDays(89),
    ])->save();
});

it('echoes the requested range in the payload', function () {
    $this->asUser($this->lead)
        ->getJson('/api/reports/summary?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        ->assertJsonPath('range.from', '2026-07-01')
        ->assertJsonPath('range.to', '2026-07-31');
});

it('defaults to the last 30 days when params are omitted', function () {
    $res = $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();

    expect($res->json('ticket_volume.points'))->toHaveCount(30);
});

it('excludes out-of-range tickets from every block', function () {
    $res = $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();

    // channel mix: only the in-range Email ticket, never the 90-day-old chat.
    $channels = collect($res->json('channels.items'))->pluck('channel');
    expect($channels)->toContain('email')->not->toContain('chat');

    // agent performance: exactly one resolved ticket in range.
    expect($res->json('agents.items.0.resolved'))->toBe(1);

    // ticket volume: total created across the window is 1.
    $created = collect($res->json('ticket_volume.points'))->sum('created');
    expect($created)->toBe(1);
});

it('returns 422 when from is after to', function () {
    $this->asUser($this->lead)
        ->getJson('/api/reports/summary?from=2026-08-31&to=2026-08-01')
        ->assertStatus(422);
});

it('returns 422 for an absurdly wide range', function () {
    $this->asUser($this->lead)
        ->getJson('/api/reports/summary?from=2000-01-01&to=2026-08-28')
        ->assertStatus(422);
});
