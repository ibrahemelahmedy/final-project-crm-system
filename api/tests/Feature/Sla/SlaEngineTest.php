<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    Carbon::setTestNow('2026-08-01 09:00:00');

    $this->rule = SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
        'at_risk_threshold_pct' => 80,
        'escalation_enabled' => true,
        'escalate_after_minutes' => 30,
        'escalate_to_role' => UserRole::TeamLead->value,
        'auto_close_after_days' => 5,
    ]);

    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

afterEach(function () {
    Carbon::setTestNow();
});

/** An Urgent ticket with its targets stamped, exactly as creation stamps them. */
function engineTicket(array $overrides = []): Ticket
{
    $ticket = Ticket::factory()->create(array_merge([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ], $overrides));

    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    return $ticket->fresh();
}

it('flags an at-risk ticket once and not again on a second run', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);

    // Inside the at-risk window (192m..240m).
    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(200));

    $this->artisan('sla:evaluate')->assertSuccessful();

    $first = $ticket->fresh()->sla_at_risk_notified_at;
    expect($first)->not->toBeNull();

    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(210));
    $this->artisan('sla:evaluate')->assertSuccessful();

    // Unchanged — the guard makes the pass idempotent.
    expect($ticket->fresh()->sla_at_risk_notified_at->equalTo($first))->toBeTrue();
});

it('flags a breached ticket and suppresses the at-risk alert it never sent', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);

    // Straight past the breach — the engine was down through the whole
    // at-risk window.
    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(300));

    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    expect($reloaded->sla_breached_notified_at)->not->toBeNull();
    // Both guards closed: two alerts at once is noise, and the breach is the
    // actionable one.
    expect($reloaded->sla_at_risk_notified_at)->not->toBeNull();
});

it('skips paused tickets entirely', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);
    $clock = app(SlaClock::class);
    $clock->pause($ticket, $ticket->created_at->copy()->addMinutes(10));
    $ticket->save();

    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(600));
    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    expect($reloaded->sla_at_risk_notified_at)->toBeNull();
    expect($reloaded->sla_breached_notified_at)->toBeNull();
});

it('skips resolved and closed tickets', function () {
    $resolved = engineTicket(['status' => TicketStatus::Resolved->value]);
    $closed = engineTicket(['status' => TicketStatus::Closed->value]);

    Carbon::setTestNow(Carbon::now()->addMinutes(600));
    $this->artisan('sla:evaluate')->assertSuccessful();

    expect($resolved->fresh()->sla_breached_notified_at)->toBeNull();
    expect($closed->fresh()->sla_breached_notified_at)->toBeNull();
});

it('escalates an unanswered urgent ticket to the configured role and writes an event', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);

    // escalate_at is response_due (15m) + 30m = 45m.
    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(60));
    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    expect($reloaded->escalated_at)->not->toBeNull();
    expect($reloaded->assigned_to)->toBe($lead->id);

    $event = TicketEvent::where('ticket_id', $ticket->id)->where('event', 'escalated')->first();
    expect($event)->not->toBeNull();
    expect($event->new_value)->toBe((string) $lead->id);
    // Engine-written, so the actor is null — Story 04 renders that as "System".
    expect($event->user_id)->toBeNull();
});

it('does not escalate a ticket that already has a first response', function () {
    User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);
    $ticket->forceFill(['first_response_at' => $ticket->created_at->copy()->addMinutes(5)])->save();

    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(60));
    $this->artisan('sla:evaluate')->assertSuccessful();

    expect($ticket->fresh()->escalated_at)->toBeNull();
    expect($ticket->fresh()->assigned_to)->toBe($this->agent->id);
});

it('stamps escalated_at without reassigning when no target role user exists', function () {
    // No Team Lead in the database at all.
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);

    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(60));
    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    // Stamped, not retried — otherwise this ticket is reprocessed every five
    // minutes forever.
    expect($reloaded->escalated_at)->not->toBeNull();
    expect($reloaded->assigned_to)->toBe($this->agent->id);
});

it('auto-closes a resolved ticket past its window and writes an auto_closed event', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);
    $ticket->forceFill([
        'status' => TicketStatus::Resolved->value,
        'resolved_at' => Carbon::now(),
    ])->save();

    Carbon::setTestNow(Carbon::now()->addDays(6));
    $this->artisan('sla:evaluate')->assertSuccessful();

    $reloaded = $ticket->fresh();
    expect($reloaded->status)->toBe(TicketStatus::Closed);
    expect($reloaded->closed_at)->not->toBeNull();
    expect(TicketEvent::where('ticket_id', $ticket->id)->where('event', 'auto_closed')->exists())->toBeTrue();
});

it('does not auto-close a ticket resolved inside its window', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);
    $ticket->forceFill(['status' => TicketStatus::Resolved->value, 'resolved_at' => Carbon::now()])->save();

    Carbon::setTestNow(Carbon::now()->addDays(2));
    $this->artisan('sla:evaluate')->assertSuccessful();

    expect($ticket->fresh()->status)->toBe(TicketStatus::Resolved);
});

it('does not auto-close a reopened ticket', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);

    $this->asUser($admin)->patchJson("/api/tickets/{$ticket->id}", ['status' => 'resolved'])->assertOk();
    $this->asUser($admin)->patchJson("/api/tickets/{$ticket->id}", ['status' => 'open'])->assertOk();

    // Story 04 clears resolved_at on the way out of Resolved, which is what
    // makes the auto-close query skip this row.
    expect($ticket->fresh()->resolved_at)->toBeNull();

    Carbon::setTestNow(Carbon::now()->addDays(10));
    $this->artisan('sla:evaluate')->assertSuccessful();

    expect($ticket->fresh()->status)->toBe(TicketStatus::Open);
});

it('catches up after a seven-day gap without duplicating notifications', function () {
    $a = engineTicket(['assigned_to' => $this->agent->id]);
    $b = engineTicket(['assigned_to' => $this->agent->id]);

    Carbon::setTestNow(Carbon::now()->addDays(7));

    $this->artisan('sla:evaluate')->assertSuccessful();
    $this->artisan('sla:evaluate')->assertSuccessful();
    $this->artisan('sla:evaluate')->assertSuccessful();

    foreach ([$a, $b] as $ticket) {
        $reloaded = $ticket->fresh();
        expect($reloaded->sla_breached_notified_at)->not->toBeNull();
        expect($reloaded->sla_at_risk_notified_at)->not->toBeNull();
    }

    // One breach notification per ticket, not one per missed five-minute slot.
    expect(DB::table('notifications')->where('type', 'sla_breached')->count())->toBeLessThanOrEqual(2);
});

it('writes nothing on a dry run', function () {
    $ticket = engineTicket(['assigned_to' => $this->agent->id]);
    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(300));

    $columns = ['sla_at_risk_notified_at', 'sla_breached_notified_at', 'escalated_at', 'assigned_to', 'status'];
    $before = $ticket->fresh()->only($columns);

    $this->artisan('sla:evaluate --dry-run')->assertSuccessful();

    expect($ticket->fresh()->only($columns))->toEqual($before);
});

it('backfills targets on tickets that have none and is idempotent', function () {
    $bare = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);

    expect($bare->resolution_due_at)->toBeNull();

    $this->artisan('sla:evaluate --backfill')->assertSuccessful();

    $stamped = $bare->fresh()->resolution_due_at;
    expect($stamped)->not->toBeNull();

    $this->artisan('sla:evaluate --backfill')->assertSuccessful();

    expect($bare->fresh()->resolution_due_at->equalTo($stamped))->toBeTrue();
});

it('pauses a ticket that is already pending when backfilled', function () {
    // The invariant is `sla_paused_at is non-null ONLY while Pending`, and it
    // has to hold for backfilled rows too — otherwise a ticket parked on the
    // customer keeps burning a clock it should not be running.
    //
    // Pausing at now() does NOT retroactively un-breach it: nothing records
    // when it entered Pending, so the honest result is that its state FREEZES
    // where it is rather than continuing to decay.
    $bare = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Pending->value,
    ]);
    $bare->forceFill(['created_at' => Carbon::now()->subHours(2)])->save();

    $this->artisan('sla:evaluate --backfill')->assertSuccessful();

    $reloaded = $bare->fresh();
    $clock = app(SlaClock::class);

    expect($reloaded->resolution_due_at)->not->toBeNull();
    expect($reloaded->sla_paused_at)->not->toBeNull();

    // Two hours in against a four-hour target: still healthy, and it stays
    // healthy however far the clock is travelled, because it is frozen.
    expect($clock->riskFor($reloaded))->toBe('ok');
    expect($clock->riskFor($reloaded, Carbon::now()->addDays(30)))->toBe('ok');
});

it('never notifies on a pending ticket it backfilled', function () {
    $bare = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Pending->value,
        'assigned_to' => $this->agent->id,
    ]);
    $bare->forceFill(['created_at' => Carbon::now()->subDays(3)])->save();

    $this->artisan('sla:evaluate --backfill')->assertSuccessful();

    Carbon::setTestNow(Carbon::now()->addDays(1));
    $this->artisan('sla:evaluate')->assertSuccessful();

    // slaRunning() excludes paused rows, so no alert fires for a ticket that
    // is sitting with the customer.
    $reloaded = $bare->fresh();
    expect($reloaded->sla_at_risk_notified_at)->toBeNull();
    expect($reloaded->sla_breached_notified_at)->toBeNull();
});

it('leaves an open ticket unpaused when backfilled', function () {
    $bare = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);

    $this->artisan('sla:evaluate --backfill')->assertSuccessful();

    expect($bare->fresh()->sla_paused_at)->toBeNull();
});
