<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    SlaRule::factory()->forPriority(Priority::Normal->value, 1440, 80)->create();

    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->other = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->token = fn (User $u) => $u->createToken('spa')->plainTextToken;
});

it('counts only the caller\'s own assigned open tickets in the summary', function () {
    Ticket::factory()->count(3)->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Normal->value,
    ]);
    Ticket::factory()->create([
        'assigned_to' => $this->other->id,
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Normal->value,
    ]);

    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->agent))
        ->getJson('/api/dashboard/agent/summary')
        ->assertOk()
        ->assertJson(['assigned_count' => 3]);
});

it('never returns another agent\'s tickets in the queue', function () {
    Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'subject' => 'Mine',
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Normal->value,
    ]);
    Ticket::factory()->create([
        'assigned_to' => $this->other->id,
        'subject' => 'Not mine',
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Normal->value,
    ]);

    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->agent))
        ->getJson('/api/dashboard/agent/queue')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonFragment(['subject' => 'Mine'])
        ->assertJsonMissing(['subject' => 'Not mine']);
});

it('excludes yesterday\'s resolutions from resolved_today_count', function () {
    Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Resolved->value,
        'priority' => Priority::Normal->value,
        'resolved_at' => now()->subHours(2),
    ]);
    Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Resolved->value,
        'priority' => Priority::Normal->value,
        'resolved_at' => now()->subDay()->subHours(2),
    ]);

    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->agent))
        ->getJson('/api/dashboard/agent/summary')
        ->assertOk()
        ->assertJson(['resolved_today_count' => 1]);
});
