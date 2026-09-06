<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns enabled:false with two nulls, and 503s both generate routes, when the feature is off', function () {
    config(['ai.enabled' => false]);
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    $fake = bindAssistGenerator();

    $this->asUser($agent)->getJson("/api/tickets/{$ticket->id}/ai-assist")
        ->assertOk()
        ->assertExactJson(['enabled' => false, 'summary' => null, 'suggestion' => null]);

    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertStatus(503);
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertStatus(503);

    expect($fake->timesCalled)->toBe(0);
});
