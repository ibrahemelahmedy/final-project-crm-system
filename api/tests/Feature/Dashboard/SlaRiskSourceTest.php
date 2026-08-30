<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->token = $this->agent->createToken('spa')->plainTextToken;
});

it('surfaces a ticket whose SLA risk is at_risk or breached via the shared clock', function () {
    SlaRule::factory()->forPriority(Priority::High->value, 60, 80)->create();

    // created 2h ago, resolution SLA 60m -> breached
    $ticket = Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Open->value,
        'priority' => Priority::High->value,
        'subject' => 'Breaching ticket',
    ]);
    // Backdate first, then stamp — the targets are anchored on created_at,
    // exactly as TicketController@store anchors them at creation time.
    $ticket->forceFill(['created_at' => now()->subHours(2)]);
    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    $this->asToken($this->token)
        ->getJson('/api/dashboard/agent/sla-risk')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonFragment(['subject' => 'Breaching ticket'])
        ->assertJsonPath('data.0.sla.risk', 'breached');
});

it('excludes a ticket with no active SLA rule for its priority', function () {
    // No rule for Low.
    $ticket = Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Low->value,
        'subject' => 'No rule ticket',
    ]);
    $ticket->forceFill(['created_at' => now()->subDays(30)]);
    app(SlaClock::class)->applyTo($ticket);   // no rule for Low -> stays null
    $ticket->save();

    $this->asToken($this->token)
        ->getJson('/api/dashboard/agent/sla-risk')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});
