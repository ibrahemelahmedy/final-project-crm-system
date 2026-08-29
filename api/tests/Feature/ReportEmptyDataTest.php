<?php

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

it('reports every block as unavailable with zero tickets and never a zero figure', function () {
    $res = $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();

    expect($res->json('ticket_volume.available'))->toBeFalse();
    expect($res->json('ticket_volume.points'))->toBe([]);
    expect($res->json('sla.available'))->toBeFalse();
    expect($res->json('sla.compliance_rate'))->toBeNull();
    expect($res->json('sla.breach_rate'))->toBeNull();
    expect($res->json('sla.avg_resolution_minutes'))->toBeNull();
    expect($res->json('channels.available'))->toBeFalse();
    expect($res->json('channels.items'))->toBe([]);
    expect($res->json('agents.available'))->toBeFalse();
    expect($res->json('agents.items'))->toBe([]);
});

it('has ticket volume available but agent performance unavailable when nothing is resolved', function () {
    $ticket = Ticket::factory()->create([
        'assigned_to' => $this->lead->id,
        'priority' => Priority::Normal->value,
        'status' => 'open',
    ]);
    $ticket->forceFill(['created_at' => now()->subDay(), 'resolved_at' => null])->save();

    $res = $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();

    expect($res->json('ticket_volume.available'))->toBeTrue();
    expect($res->json('agents.available'))->toBeFalse();
    expect($res->json('sla.available'))->toBeFalse();
});
