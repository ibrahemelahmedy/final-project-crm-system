<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true]);
});

it('denies an agent not assigned to the ticket on all four routes, and never calls the generator', function () {
    $owner = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $other = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($owner)->create();
    $fake = bindAssistGenerator();

    $this->asUser($other)->getJson("/api/tickets/{$ticket->id}/ai-assist")->assertForbidden();
    $this->asUser($other)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertForbidden();
    $this->asUser($other)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertForbidden();
    $this->asUser($other)->deleteJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertForbidden();

    expect($fake->timesCalled)->toBe(0);
});

it('allows the assigned agent to read and generate', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    bindAssistGenerator();

    $this->asUser($agent)->getJson("/api/tickets/{$ticket->id}/ai-assist")->assertOk();
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertOk();
});

it('allows a team lead who can see the whole queue', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->create();
    bindAssistGenerator();

    $this->asUser($lead)->getJson("/api/tickets/{$ticket->id}/ai-assist")->assertOk();
});
