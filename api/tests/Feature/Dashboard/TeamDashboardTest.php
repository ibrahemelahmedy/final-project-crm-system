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
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->token = fn (User $u) => $u->createToken('spa')->plainTextToken;
});

it('gives a Team Lead team-scoped open counts', function () {
    Ticket::factory()->count(2)->create(['status' => TicketStatus::Open->value, 'priority' => Priority::Normal->value, 'assigned_to' => $this->agent->id]);
    Ticket::factory()->create(['status' => TicketStatus::Closed->value, 'priority' => Priority::Normal->value]);

    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->lead))
        ->getJson('/api/dashboard/team/summary')
        ->assertOk()
        ->assertJson(['open_count' => 2, 'team_name' => 'Support Ops']);
});

it('forbids an Agent from every team endpoint', function () {
    $auth = ['Authorization' => 'Bearer '.($this->token)($this->agent)];

    $this->withHeaders($auth)->getJson('/api/dashboard/team/summary')->assertForbidden();
    $this->withHeaders($auth)->getJson('/api/dashboard/team/workload')->assertForbidden();
    $this->withHeaders($auth)->getJson('/api/dashboard/team/escalations')->assertForbidden();
});

it('returns null sla_compliance_pct when nothing resolved in the window', function () {
    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->lead))
        ->getJson('/api/dashboard/team/summary')
        ->assertOk()
        ->assertJson(['sla_compliance_pct' => null]);
});

it('lists one workload row per active agent and team lead', function () {
    $this->withHeader('Authorization', 'Bearer '.($this->token)($this->lead))
        ->getJson('/api/dashboard/team/workload')
        ->assertOk()
        ->assertJsonCount(2);
});
