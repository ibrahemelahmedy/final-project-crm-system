<?php

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\TicketTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('dispatches exactly one task_due notification per overdue task', function () {
    $ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
    $task = TicketTask::factory()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
        'due_at' => now()->subHour(),
    ]);

    $this->artisan('tasks:dispatch-due-reminders')->assertSuccessful();

    expect(Notification::where('user_id', $this->agent->id)->where('type', 'task_due')->count())->toBe(1);
    expect($task->fresh()->reminded_at)->not->toBeNull();
});

it('dispatches nothing on a second run — the reminded_at guard', function () {
    $ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
    TicketTask::factory()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
        'due_at' => now()->subHour(),
    ]);

    $this->artisan('tasks:dispatch-due-reminders')->assertSuccessful();
    $this->artisan('tasks:dispatch-due-reminders')->assertSuccessful();

    expect(Notification::where('user_id', $this->agent->id)->where('type', 'task_due')->count())->toBe(1);
});

it('dispatches nothing for a task on a closed ticket', function () {
    $ticket = Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'status' => TicketStatus::Closed->value,
        'closed_at' => now(),
    ]);
    // Cancelled the way the close hook would — status is what the reminder
    // query actually filters on.
    TicketTask::factory()->create([
        'ticket_id' => $ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
        'due_at' => now()->subHour(),
        'status' => 'cancelled',
        'cancel_reason' => 'ticket_closed',
    ]);

    $this->artisan('tasks:dispatch-due-reminders')->assertSuccessful();

    expect(Notification::where('user_id', $this->agent->id)->where('type', 'task_due')->count())->toBe(0);
});
