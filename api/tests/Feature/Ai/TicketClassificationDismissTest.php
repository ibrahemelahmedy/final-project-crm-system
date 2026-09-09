<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** Story 24 (WIS-23), Test Plan B. DELETE /api/tickets/{id}/ai-classification. */
it('clears the suggestion and the flag but keeps confidence and classified_at', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create([
        'ai_suggested_category' => 'technical',
        'ai_suggested_priority' => 'urgent',
        'ai_confidence' => 0.91,
        'ai_classified_at' => now(),
        'needs_triage' => true,
    ]);

    test()->asUser($agent)->deleteJson("/api/tickets/{$ticket->id}/ai-classification")
        ->assertNoContent();

    $fresh = $ticket->fresh();
    expect($fresh->ai_suggested_category)->toBeNull()
        ->and($fresh->ai_suggested_priority)->toBeNull()
        ->and($fresh->needs_triage)->toBeFalse()
        ->and($fresh->ai_confidence)->toBe(0.91)
        ->and($fresh->ai_classified_at)->not->toBeNull();
});

it('returns 403 for an agent who cannot update the ticket', function () {
    $owner = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $other = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($owner)->create(['ai_classified_at' => now()]);

    test()->asUser($other)->deleteJson("/api/tickets/{$ticket->id}/ai-classification")
        ->assertForbidden();
});

it('is not throttled by the ai-assist limiter', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['ai_classified_at' => now()]);

    foreach (range(1, 10) as $_) {
        test()->asUser($agent)->deleteJson("/api/tickets/{$ticket->id}/ai-classification")
            ->assertNoContent();
    }
});
