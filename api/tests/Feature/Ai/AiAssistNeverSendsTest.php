<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Story 19 (WIS-18) — the no-auto-send guarantee, stated as a test.
 * Generating a suggestion is not communicating: it must never create a
 * ticket_messages row or a ticket_events row.
 */
it('never creates a ticket message or event when generating a suggestion', function () {
    config(['ai.enabled' => true]);
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    TicketMessage::factory()->for($ticket)->create();

    $messagesBefore = TicketMessage::where('ticket_id', $ticket->id)->count();
    $eventsBefore = TicketEvent::where('ticket_id', $ticket->id)->count();

    bindAssistGenerator();
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertOk();

    expect(TicketMessage::where('ticket_id', $ticket->id)->count())->toBe($messagesBefore);
    expect(TicketEvent::where('ticket_id', $ticket->id)->count())->toBe($eventsBefore);
});
