<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/**
 * The intake's pause criterion, end to end through the HTTP API rather than
 * against the service — a ticket parked on the customer must not burn its SLA.
 */
it('freezes and then resumes the clock across a pending span', function () {
    Carbon::setTestNow('2026-08-01 09:00:00');

    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
        'at_risk_threshold_pct' => 80,
    ]);

    $ticket = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);
    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    $originalDue = $ticket->fresh()->resolution_due_at->copy();

    // Park it on the customer one hour in.
    Carbon::setTestNow($ticket->created_at->copy()->addHour());
    $this->asUser($admin)->patchJson("/api/tickets/{$ticket->id}", ['status' => 'pending'])->assertOk();

    expect($ticket->fresh()->sla_paused_at)->not->toBeNull();

    // Three hours pass. Without the pause this 240-minute target would now be
    // deep into the at-risk window.
    Carbon::setTestNow($ticket->created_at->copy()->addHours(4));

    $paused = $this->asUser($admin)->getJson("/api/tickets/{$ticket->id}")->assertOk()->json('data.sla');
    expect($paused['risk'])->toBe('ok');

    $this->asUser($admin)->patchJson("/api/tickets/{$ticket->id}", ['status' => 'open'])->assertOk();

    $reloaded = $ticket->fresh();

    expect($reloaded->sla_paused_at)->toBeNull();
    expect($reloaded->sla_paused_minutes)->toBe(180);
    expect($reloaded->resolution_due_at->equalTo($originalDue->copy()->addMinutes(180)))->toBeTrue();

    // Still healthy after the resume: only one of the four hours was its own.
    $after = $this->asUser($admin)->getJson("/api/tickets/{$ticket->id}")->assertOk()->json('data.sla');
    expect($after['risk'])->toBe('ok');

    Carbon::setTestNow();
});

it('is never breached or at risk by the engine while pending', function () {
    Carbon::setTestNow('2026-08-01 09:00:00');

    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    $ticket = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);
    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    $this->asUser($admin)->patchJson("/api/tickets/{$ticket->id}", ['status' => 'pending'])->assertOk();

    Carbon::setTestNow($ticket->created_at->copy()->addDays(3));
    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    expect($reloaded->sla_breached_notified_at)->toBeNull();
    expect($reloaded->sla_at_risk_notified_at)->toBeNull();

    Carbon::setTestNow();
});
