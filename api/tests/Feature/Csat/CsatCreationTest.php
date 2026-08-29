<?php

use App\Enums\UserRole;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function resolveTicket(User $actor, Ticket $ticket): void
{
    test()->asUser($actor)
        ->patchJson('/api/tickets/'.$ticket->id, ['status' => 'resolved'])
        ->assertOk();
}

it('creates exactly one survey when a ticket is resolved, capturing who and when', function () {
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['status' => 'open']);

    resolveTicket($agent, $ticket);

    $surveys = CsatSurvey::where('ticket_id', $ticket->id)->get();
    expect($surveys)->toHaveCount(1);
    expect($surveys[0]->resolved_by)->toBe($agent->id);
    expect($surveys[0]->resolution_cycle)->toBe(1);
    expect($surveys[0]->resolved_at)->not->toBeNull();
    expect($surveys[0]->rating)->toBeNull();
});

it('does not create a second survey when the ticket is resolved twice while outstanding', function () {
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['status' => 'open']);

    resolveTicket($agent, $ticket);
    test()->asUser($agent)->patchJson('/api/tickets/'.$ticket->id, ['status' => 'open'])->assertOk();
    resolveTicket($agent, $ticket->fresh());

    expect(CsatSurvey::where('ticket_id', $ticket->id)->count())->toBe(1);
});

it('opens cycle 2 after an answered cycle 1 is re-resolved', function () {
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['status' => 'open']);

    resolveTicket($agent, $ticket);
    CsatSurvey::where('ticket_id', $ticket->id)->update([
        'rating' => 5, 'responded_at' => now(),
    ]);

    test()->asUser($agent)->patchJson('/api/tickets/'.$ticket->id, ['status' => 'open'])->assertOk();
    resolveTicket($agent, $ticket->fresh());

    $cycles = CsatSurvey::where('ticket_id', $ticket->id)->orderBy('resolution_cycle')->pluck('resolution_cycle');
    expect($cycles->all())->toBe([1, 2]);
});

it('leaves no survey when the resolving transaction rolls back', function () {
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['status' => 'open']);

    try {
        DB::transaction(function () use ($ticket) {
            $ticket->update(['status' => 'resolved', 'resolved_at' => now()]);
            throw new RuntimeException('boom');
        });
    } catch (RuntimeException) {
        // expected
    }

    expect(CsatSurvey::where('ticket_id', $ticket->id)->count())->toBe(0);
});
