<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    Carbon::setTestNow('2026-08-01 09:00:00');
    $this->clock = app(SlaClock::class);
    $this->window = [Carbon::now()->subDays(30), Carbon::now()->addDay()];
});

afterEach(function () {
    Carbon::setTestNow();
});

/** Resolved $minutesToResolve after creation, under an Urgent 240-minute rule. */
function resolvedTicket(int $minutesToResolve, ?int $pausedMinutes = null): Ticket
{
    $ticket = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Resolved->value,
    ]);

    $created = Carbon::now()->subDays(2);
    $ticket->forceFill(['created_at' => $created]);

    if ($pausedMinutes !== null) {
        $ticket->forceFill(['sla_paused_minutes' => $pausedMinutes]);
    }

    app(SlaClock::class)->applyTo($ticket);
    $ticket->forceFill(['resolved_at' => $created->copy()->addMinutes($minutesToResolve)])->save();

    return $ticket->fresh();
}

it('returns null rates and a zero count for an empty window', function () {
    $result = $this->clock->complianceBetween(...$this->window);

    // Never 0 — a 0% compliance figure on a quiet week is a false alarm.
    expect($result['compliance_rate'])->toBeNull();
    expect($result['breach_rate'])->toBeNull();
    expect($result['avg_resolution_minutes'])->toBeNull();
    expect($result['resolved_count'])->toBe(0);
});

it('excludes tickets with no resolution target from both numerator and denominator', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    resolvedTicket(100);    // measured, compliant

    // A Low ticket with no rule: resolved, but never measured — and crucially
    // never counted compliant.
    $unmeasured = Ticket::factory()->create([
        'priority' => Priority::Low->value,
        'status' => TicketStatus::Resolved->value,
    ]);
    $unmeasured->forceFill([
        'created_at' => Carbon::now()->subDays(2),
        'resolved_at' => Carbon::now()->subDay(),
    ])->save();

    $result = $this->clock->complianceBetween(...$this->window);

    expect($result['resolved_count'])->toBe(1);
    expect($result['compliance_rate'])->toBe(100.0);
});

it('counts a ticket resolved exactly on its target as compliant', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    resolvedTicket(240);

    $result = $this->clock->complianceBetween(...$this->window);

    expect($result['compliance_rate'])->toBe(100.0);
    expect($result['breach_rate'])->toBe(0.0);
});

it('splits compliance and breach across a mixed window', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    resolvedTicket(100);    // compliant
    resolvedTicket(500);    // breached

    $result = $this->clock->complianceBetween(...$this->window);

    expect($result['resolved_count'])->toBe(2);
    expect($result['compliance_rate'])->toBe(50.0);
    expect($result['breach_rate'])->toBe(50.0);
});

it('subtracts paused minutes from the average resolution time', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    // 200 minutes wall-clock, 60 of them paused: the average measures agent
    // handling time, which is what the clock actually counted.
    resolvedTicket(200, pausedMinutes: 60);

    $result = $this->clock->complianceBetween(...$this->window);

    expect($result['avg_resolution_minutes'])->toBe(140);
});
