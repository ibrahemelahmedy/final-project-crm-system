<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/** The seeded Urgent tier: 15m response, 240m resolution, 80% at-risk, escalate 30m after response due. */
function urgentRule(): SlaRule
{
    return SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
        'at_risk_threshold_pct' => 80,
        'escalation_enabled' => true,
        'escalate_after_minutes' => 30,
        'escalate_to_role' => 'administrator',
    ]);
}

function urgentTicket(): Ticket
{
    $ticket = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);

    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    return $ticket->fresh();
}

beforeEach(function () {
    Carbon::setTestNow('2026-08-01 09:00:00');
});

afterEach(function () {
    Carbon::setTestNow();
});

it('stamps response, resolution, at-risk and escalation targets from the tier', function () {
    urgentRule();
    $ticket = urgentTicket();

    $created = $ticket->created_at;

    expect($ticket->first_response_due_at->equalTo($created->copy()->addMinutes(15)))->toBeTrue();
    expect($ticket->resolution_due_at->equalTo($created->copy()->addMinutes(240)))->toBeTrue();
    // 80% threshold -> at risk once 20% (48m) of the 240m target remains.
    expect($ticket->sla_at_risk_at->equalTo($created->copy()->addMinutes(192)))->toBeTrue();
    // escalate_after_minutes counts from the RESPONSE due date: 15 + 30.
    expect($ticket->escalate_at->equalTo($created->copy()->addMinutes(45)))->toBeTrue();
});

it('leaves every target null when the tier has no active rule', function () {
    // A rule exists, but it is deactivated.
    urgentRule()->update(['is_active' => false]);
    $ticket = urgentTicket();

    expect($ticket->sla_rule_id)->toBeNull();
    expect($ticket->resolution_due_at)->toBeNull();
    expect($ticket->sla_at_risk_at)->toBeNull();
    expect($ticket->escalate_at)->toBeNull();
});

it('returns ok, at_risk and breached at the three boundaries', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $created = $ticket->created_at;

    expect($clock->riskFor($ticket, $created->copy()->addMinutes(191)))->toBe('ok');
    expect($clock->riskFor($ticket, $created->copy()->addMinutes(192)))->toBe('at_risk');
    expect($clock->riskFor($ticket, $created->copy()->addMinutes(241)))->toBe('breached');
});

it('returns null risk for a ticket with no resolution target', function () {
    $ticket = urgentTicket();   // no rule seeded at all

    expect(app(SlaClock::class)->riskFor($ticket))->toBeNull();
    expect(app(SlaClock::class)->minutesLeft($ticket))->toBeNull();
});

it('freezes the clock while a ticket is paused', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $created = $ticket->created_at;

    $clock->pause($ticket, $created->copy()->addMinutes(100));
    $ticket->save();

    $frozen = $clock->minutesLeft($ticket, $created->copy()->addMinutes(100));

    // Travel far past the target — a paused clock does not move.
    expect($clock->riskFor($ticket, $created->copy()->addMinutes(300)))->toBe('ok');
    expect($clock->minutesLeft($ticket, $created->copy()->addMinutes(300)))->toBe($frozen);
});

it('pushes every target forward by the paused span on resume', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $created = $ticket->created_at;

    $before = [
        'first_response_due_at' => $ticket->first_response_due_at->copy(),
        'resolution_due_at' => $ticket->resolution_due_at->copy(),
        'sla_at_risk_at' => $ticket->sla_at_risk_at->copy(),
        'escalate_at' => $ticket->escalate_at->copy(),
    ];

    $clock->pause($ticket, $created->copy()->addMinutes(100));
    $clock->resume($ticket, $created->copy()->addMinutes(300));
    $ticket->save();

    foreach ($before as $field => $original) {
        expect($ticket->{$field}->equalTo($original->copy()->addMinutes(200)))->toBeTrue();
    }

    expect($ticket->sla_paused_minutes)->toBe(200);
    expect($ticket->sla_paused_at)->toBeNull();
});

it('does not pause twice', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $first = $ticket->created_at->copy()->addMinutes(10);

    $clock->pause($ticket, $first);
    $clock->pause($ticket, $ticket->created_at->copy()->addMinutes(90));

    expect($ticket->sla_paused_at->equalTo($first))->toBeTrue();
});

it('does not resume an unpaused ticket', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $due = $ticket->resolution_due_at->copy();

    $clock->resume($ticket, $ticket->created_at->copy()->addMinutes(300));

    expect($ticket->resolution_due_at->equalTo($due))->toBeTrue();
    expect($ticket->sla_paused_minutes)->toBe(0);
});

it('marks first response only once', function () {
    urgentRule();
    $ticket = urgentTicket();
    $clock = app(SlaClock::class);
    $first = $ticket->created_at->copy()->addMinutes(5);

    $clock->markFirstResponse($ticket, $first);
    $clock->markFirstResponse($ticket, $ticket->created_at->copy()->addMinutes(60));

    expect($ticket->first_response_at->equalTo($first))->toBeTrue();
});

it('re-anchors targets on a priority change', function () {
    urgentRule();
    SlaRule::factory()->create([
        'priority' => Priority::Normal->value,
        'first_response_minutes' => 240,
        'resolution_minutes' => 1440,
    ]);

    $ticket = Ticket::factory()->create([
        'priority' => Priority::Normal->value,
        'status' => TicketStatus::Open->value,
    ]);
    $clock = app(SlaClock::class);
    $clock->applyTo($ticket);
    $ticket->save();

    expect($ticket->resolution_due_at->equalTo($ticket->created_at->copy()->addMinutes(1440)))->toBeTrue();

    // Escalated to Urgent 30 minutes in: the new target is anchored on
    // created_at, so only 210 of Urgent's 240 minutes remain.
    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(30));
    $ticket->priority = Priority::Urgent;
    $clock->applyTo($ticket);
    $ticket->save();

    expect($ticket->resolution_due_at->equalTo($ticket->created_at->copy()->addMinutes(240)))->toBeTrue();
    expect($clock->minutesLeft($ticket))->toBe(210);
});

it('classifies a resolved ticket ok when it finished in time and breached when late', function () {
    urgentRule();
    $clock = app(SlaClock::class);

    $onTime = urgentTicket();
    $onTime->forceFill([
        'status' => TicketStatus::Resolved->value,
        'resolved_at' => $onTime->created_at->copy()->addMinutes(100),
    ])->save();

    $late = urgentTicket();
    $late->forceFill([
        'status' => TicketStatus::Resolved->value,
        'resolved_at' => $late->created_at->copy()->addMinutes(500),
    ])->save();

    expect($clock->riskFor($onTime))->toBe('ok');
    expect($clock->riskFor($late))->toBe('breached');
});

it('never reports a resolved ticket as at_risk', function () {
    urgentRule();
    $clock = app(SlaClock::class);

    $ticket = urgentTicket();
    // Resolved inside the at-risk window (192m..240m) — still `ok`, not at_risk.
    $ticket->forceFill([
        'status' => TicketStatus::Resolved->value,
        'resolved_at' => $ticket->created_at->copy()->addMinutes(200),
    ])->save();

    expect($clock->riskFor($ticket))->toBe('ok');
});
