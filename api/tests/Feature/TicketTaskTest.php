<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\TicketTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->other = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
});

it('defaults the assignee to the creator when none is given', function () {
    $response = $this->asUser($this->agent)
        ->postJson("/api/tickets/{$this->ticket->id}/tasks", ['title' => 'Call back tomorrow'])
        ->assertCreated();

    $response->assertJsonPath('data.assignee.id', $this->agent->id);
});

it('lets a creator assign a task to someone else', function () {
    $response = $this->asUser($this->agent)
        ->postJson("/api/tickets/{$this->ticket->id}/tasks", [
            'title' => 'Chase vendor',
            'assignee_id' => $this->other->id,
        ])
        ->assertCreated();

    $response->assertJsonPath('data.assignee.id', $this->other->id);
});

it('records completed_by and completed_at on complete', function () {
    $task = TicketTask::factory()->create([
        'ticket_id' => $this->ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
    ]);

    $response = $this->asUser($this->agent)
        ->postJson("/api/tasks/{$task->id}/complete")
        ->assertOk();

    $response->assertJsonPath('data.status', 'completed')
        ->assertJsonPath('data.completed_by.id', $this->agent->id);

    expect($task->fresh()->completed_at)->not->toBeNull();
});

it('excludes a completed task from the reminder query', function () {
    $task = TicketTask::factory()->completed()->create([
        'ticket_id' => $this->ticket->id,
        'due_at' => now()->subDay(),
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
    ]);

    expect(TicketTask::query()->dueForReminder()->pluck('id'))->not->toContain($task->id);
});

it('returns only the caller open tasks for assignee=me&status=open', function () {
    $mine = TicketTask::factory()->create([
        'ticket_id' => $this->ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
        'status' => 'open',
    ]);
    TicketTask::factory()->create([
        'ticket_id' => $this->ticket->id,
        'assignee_id' => $this->other->id,
        'created_by' => $this->other->id,
        'status' => 'open',
    ]);
    TicketTask::factory()->completed()->create([
        'ticket_id' => $this->ticket->id,
        'assignee_id' => $this->agent->id,
        'created_by' => $this->agent->id,
    ]);

    $response = $this->asUser($this->agent)
        ->getJson('/api/tasks?assignee=me&status=open')
        ->assertOk();

    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($mine->id)->and($ids)->toHaveCount(1);
});
