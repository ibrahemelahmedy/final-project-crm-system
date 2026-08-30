<?php

namespace App\Services;

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\SlaRule;
use App\Models\Ticket;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Story 06 (WIS-6). The single place SLA threshold arithmetic exists.
 *
 * Every screen, widget, report and job reads risk through this class. No
 * controller, resource, command or test recomputes a threshold, and no caller
 * reads `sla_rules` to classify a ticket.
 *
 * Three properties the design buys, each of which a naive version loses:
 *
 * - `snapshot()` issues NO query and needs no eager load — every input is a
 *   column on the ticket row the queue already loaded. A rule lookup per row
 *   would cost 25 queries on a 25-row page.
 * - A rule edit is inert on existing tickets: nothing in `riskFor()`,
 *   `minutesLeft()` or `snapshot()` reads a SlaRule. That is what makes "a
 *   rule edit applies going forward only" a mechanism rather than a convention.
 * - A resolved ticket reports `ok` or `breached`, never `at_risk` — its clock
 *   stopped, so "approaching" is meaningless.
 *
 * Every mutator uses forceFill() and leaves saving to the CALLER. That keeps
 * one save per engine pass and stops Story 04's booted() observer writing a
 * spurious history row for a due-date shift.
 */
class SlaClock
{
    /** @var array<string, ?SlaRule> Per-request memo — once per tier, not once per ticket. */
    private array $rules = [];

    public function ruleFor(Priority $priority): ?SlaRule
    {
        return $this->rules[$priority->value] ??= SlaRule::query()
            ->where('priority', $priority->value)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Stamp the four target timestamps from the ticket's current priority,
     * anchored on created_at plus whatever pause time has already accrued.
     * Idempotent: the same rule and the same pause total produce the same
     * timestamps.
     */
    public function applyTo(Ticket $ticket): void
    {
        $rule = $this->ruleFor($ticket->priority);

        if ($rule === null) {
            $ticket->forceFill([
                'sla_rule_id' => null,
                'first_response_due_at' => null,
                'resolution_due_at' => null,
                'sla_at_risk_at' => null,
                'escalate_at' => null,
            ]);

            return;
        }

        $anchor = ($ticket->created_at ?? Carbon::now())->copy()
            ->addMinutes((int) $ticket->sla_paused_minutes);

        $responseDue = $anchor->copy()->addMinutes($rule->first_response_minutes);
        $resolutionDue = $anchor->copy()->addMinutes($rule->resolution_minutes);

        // The unconsumed share of the target, subtracted from the due date.
        $unconsumed = (int) round($rule->resolution_minutes * (100 - $rule->at_risk_threshold_pct) / 100);
        $atRisk = $resolutionDue->copy()->subMinutes($unconsumed);

        $escalateAt = null;
        if ($rule->escalation_enabled) {
            $escalateAt = $rule->escalate_after_minutes !== null
                ? $responseDue->copy()->addMinutes($rule->escalate_after_minutes)
                : $resolutionDue->copy();
        }

        $ticket->forceFill([
            'sla_rule_id' => $rule->id,
            'first_response_due_at' => $responseDue,
            'resolution_due_at' => $resolutionDue,
            'sla_at_risk_at' => $atRisk,
            'escalate_at' => $escalateAt,
        ]);
    }

    /** Called when a ticket enters Pending. Idempotent — a non-null sla_paused_at returns early. */
    public function pause(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->sla_paused_at === null) {
            $ticket->forceFill(['sla_paused_at' => $at ?? Carbon::now()]);
        }
    }

    /** Called when a ticket leaves Pending. Pushes every target forward by the paused span. */
    public function resume(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->sla_paused_at === null) {
            return;
        }

        $now = Carbon::instance($at ?? Carbon::now());
        $paused = (int) max(0, $ticket->sla_paused_at->diffInMinutes($now, absolute: false));

        foreach (['first_response_due_at', 'resolution_due_at', 'sla_at_risk_at', 'escalate_at'] as $field) {
            if ($ticket->{$field} !== null) {
                $ticket->forceFill([$field => $ticket->{$field}->copy()->addMinutes($paused)]);
            }
        }

        $ticket->forceFill([
            'sla_paused_at' => null,
            'sla_paused_minutes' => (int) $ticket->sla_paused_minutes + $paused,
        ]);
    }

    /** Idempotent — the FIRST caller wins, which is why Story 05's message hook is authoritative. */
    public function markFirstResponse(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->first_response_at === null) {
            $ticket->forceFill(['first_response_at' => $at ?? Carbon::now()]);
        }
    }

    /** @return 'breached'|'at_risk'|'ok'|null */
    public function riskFor(Ticket $ticket, ?CarbonInterface $now = null): ?string
    {
        if ($ticket->resolution_due_at === null) {
            return null;
        }

        if (in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true)) {
            return $this->wasMetOnClose($ticket) ? 'ok' : 'breached';
        }

        $at = Carbon::instance($now ?? Carbon::now());

        // A paused ticket's clock is frozen at the moment it paused.
        if ($ticket->sla_paused_at !== null) {
            $at = $ticket->sla_paused_at;
        }

        if ($ticket->resolution_due_at->lessThanOrEqualTo($at)) {
            return 'breached';
        }

        if ($ticket->sla_at_risk_at !== null && $ticket->sla_at_risk_at->lessThanOrEqualTo($at)) {
            return 'at_risk';
        }

        return 'ok';
    }

    /** Negative once breached. Frozen while paused. Null with no target. */
    public function minutesLeft(Ticket $ticket, ?CarbonInterface $now = null): ?int
    {
        if ($ticket->resolution_due_at === null) {
            return null;
        }

        $at = $ticket->sla_paused_at
            ?? ($ticket->finishedAt() ?? Carbon::instance($now ?? Carbon::now()));

        return (int) $at->diffInMinutes($ticket->resolution_due_at, absolute: false);
    }

    /**
     * The exact array TicketResource's fixed `sla` block consumes — three
     * keys, the same three names, the order Story 04 pinned.
     *
     * @return array{due_at: ?string, minutes_left: ?int, risk: ?string}
     */
    public function snapshot(Ticket $ticket, ?CarbonInterface $now = null): array
    {
        return [
            'due_at' => $ticket->resolution_due_at?->toISOString(),
            'minutes_left' => $this->minutesLeft($ticket, $now),
            'risk' => $this->riskFor($ticket, $now),
        ];
    }

    /**
     * Range-scoped compliance. Story 12's Reports dashboard binds to these
     * four keys exactly.
     *
     * Rates are `null`, never `0`, on an empty window — Story 07 and Story 12
     * both render `—` for a null rate, and a 0% compliance figure on a quiet
     * week is a false alarm. Tickets with a null `resolution_due_at` are
     * excluded from BOTH numerator and denominator; they are never counted
     * compliant. `avg_resolution_minutes` subtracts paused time, so the
     * average measures agent handling time — what the clock actually counted.
     *
     * @return array{compliance_rate: ?float, breach_rate: ?float, avg_resolution_minutes: ?int, resolved_count: int}
     */
    public function complianceBetween(CarbonInterface $from, CarbonInterface $to): array
    {
        $tickets = Ticket::query()
            ->whereNotNull('resolution_due_at')
            ->whereNotNull('resolved_at')
            ->whereBetween('resolved_at', [$from, $to])
            ->get(['id', 'created_at', 'resolved_at', 'closed_at', 'resolution_due_at', 'sla_paused_minutes', 'status']);

        $count = $tickets->count();

        if ($count === 0) {
            return [
                'compliance_rate' => null,
                'breach_rate' => null,
                'avg_resolution_minutes' => null,
                'resolved_count' => 0,
            ];
        }

        $met = $tickets->filter(fn (Ticket $t) => $this->riskFor($t) === 'ok')->count();
        $minutes = $tickets->map(
            fn (Ticket $t) => $t->created_at->diffInMinutes($t->finishedAt(), absolute: true) - (int) $t->sla_paused_minutes
        );

        return [
            'compliance_rate' => round($met / $count * 100, 1),
            'breach_rate' => round(($count - $met) / $count * 100, 1),
            'avg_resolution_minutes' => (int) round($minutes->avg()),
            'resolved_count' => $count,
        ];
    }

    private function wasMetOnClose(Ticket $ticket): bool
    {
        $finishedAt = $ticket->finishedAt();

        return $finishedAt !== null && $finishedAt->lessThanOrEqualTo($ticket->resolution_due_at);
    }
}
