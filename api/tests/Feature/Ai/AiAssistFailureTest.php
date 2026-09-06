<?php

use App\Enums\UserRole;
use App\Models\AiAssistArtifact;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 503 with a localised body, writes no row, and leaves a previously cached row intact on failure', function () {
    config(['ai.enabled' => true]);
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();

    // Seed a previously cached summary via a succeeding generator. One fake
    // for the whole test — see bindAssistGenerator()'s docblock on why a
    // second app()->instance() mid-test would not take effect once the
    // /summary and /reply routes' controllers are already resolved.
    $fake = bindAssistGenerator('Cached summary.');
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertOk();

    // ...then a regenerate that fails must not disturb it.
    $fake->failNext();
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")
        ->assertStatus(503)
        ->assertJsonStructure(['message']);

    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'summary')->count())->toBe(1);
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'summary')->first()->content)
        ->toBe('Cached summary.');

    // And a first-ever attempt that fails writes nothing.
    $fake->failNext();
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertStatus(503);

    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'suggested_reply')->count())->toBe(0);
});
