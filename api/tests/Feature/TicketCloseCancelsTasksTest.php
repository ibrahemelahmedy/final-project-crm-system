<?php

use App\Enums\TaskStatus;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\TicketTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('cancels open tasks with cancel_reason=ticket_closed when the ticket closes, and reports the count', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['status' => TicketStatus::Open->value]);

    $taskOne = TicketTask::factory()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $lead->id,
        'created_by' => $lead->id,
    ]);
    $taskTwo = TicketTask::factory()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $lead->id,
        'created_by' => $lead->id,
    ]);
    // An already-completed task must be left alone.
    $completed = TicketTask::factory()->completed()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $lead->id,
        'created_by' => $lead->id,
    ]);

    $response = $this->asUser($lead)
        ->patchJson("/api/tickets/{$ticket->id}", ['status' => TicketStatus::Closed->value])
        ->assertOk();

    $response->assertJsonPath('cancelled_tasks_count', 2);

    expect($taskOne->fresh()->status)->toBe(TaskStatus::Cancelled)
        ->and($taskOne->fresh()->cancel_reason)->toBe('ticket_closed')
        ->and($taskTwo->fresh()->status)->toBe(TaskStatus::Cancelled)
        ->and($completed->fresh()->status)->toBe(TaskStatus::Completed);
});
