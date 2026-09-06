<?php

use App\Enums\UserRole;
use App\Models\AiAssistArtifact;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true]);
});

it('dismisses the suggested reply, is idempotent, and a regenerate clears the dismissal', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    bindAssistGenerator();

    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertOk();

    $this->asUser($agent)->deleteJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertStatus(204);
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'suggested_reply')->first()->dismissed_at)
        ->not->toBeNull();

    $this->asUser($agent)->getJson("/api/tickets/{$ticket->id}/ai-assist")
        ->assertOk()
        ->assertJsonPath('suggestion.dismissed', true);

    // Idempotent — a second DELETE still 204s.
    $this->asUser($agent)->deleteJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertStatus(204);

    // A regenerate clears the dismissal.
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertOk();
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'suggested_reply')->first()->dismissed_at)
        ->toBeNull();
});
