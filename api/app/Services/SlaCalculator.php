<?php

namespace App\Services;

use App\Models\SlaRule;
use App\Models\Ticket;
use Illuminate\Support\Carbon;

/**
 * The single SLA-risk source for the whole app.
 *
 * Story 06 (SLA Rules & Automation) owns this contract long-term and will
 * fold in first-response tracking, escalation timers and the notify-on-breach
 * job. Until Story 06 lands, this class is the one place a threshold is
 * evaluated — Story 07's dashboard widgets, and any later consumer, call
 * {@see self::for()} and never re-derive a cutoff of their own.
 *
 * Risk is derived from `sla_rules.resolution_minutes` and
 * `sla_rules.at_risk_threshold_pct`, measured from `tickets.created_at` in the
 * server timezone. A ticket whose priority has no active rule has no SLA and
 * is reported as `null` — never as "compliant".
 */
class SlaCalculator
{
    /** @var array<string, SlaRule|null> */
    private array $ruleCache = [];

    /**
     * @return array{due_at: string, first_response_due_at: string, minutes_left: int, risk: 'ok'|'at_risk'|'breached'}|null
     */
    public function for(Ticket $ticket, ?Carbon $now = null): ?array
    {
        $rule = $this->ruleForPriority($ticket->priority->value);

        if ($rule === null || $ticket->created_at === null) {
            return null;
        }

        $now ??= Carbon::now();
        $createdAt = $ticket->created_at->copy();

        // Story 06 stores per-ticket SLA timestamps at creation and never
        // re-derives them (a rule edit is non-retroactive). Prefer those when
        // present; fall back to computing from the rule so the dashboard works
        // before Story 06's engine backfills them.
        $storedDue = $this->asCarbon($ticket->getAttribute('resolution_due_at'));
        $storedRiskAt = $this->asCarbon($ticket->getAttribute('sla_at_risk_at'));
        $storedFirstResponseDue = $this->asCarbon($ticket->getAttribute('first_response_due_at'));

        $dueAt = $storedDue ?? $createdAt->copy()->addMinutes($rule->resolution_minutes);
        $firstResponseDueAt = $storedFirstResponseDue
            ?? $createdAt->copy()->addMinutes($rule->first_response_minutes);
        $riskAt = $storedRiskAt ?? $createdAt->copy()->addMinutes(
            (int) round($rule->resolution_minutes * $rule->at_risk_threshold_pct / 100)
        );

        // A finished ticket is measured at the moment it was resolved, not "now".
        $measuredAt = $ticket->resolved_at?->copy() ?? $ticket->closed_at?->copy() ?? $now;

        $risk = match (true) {
            $measuredAt->greaterThanOrEqualTo($dueAt) => 'breached',
            $measuredAt->greaterThanOrEqualTo($riskAt) => 'at_risk',
            default => 'ok',
        };

        return [
            'due_at' => $dueAt->toIso8601String(),
            'first_response_due_at' => $firstResponseDueAt->toIso8601String(),
            'minutes_left' => (int) round($now->diffInMinutes($dueAt, false)),
            'risk' => $risk,
        ];
    }

    /**
     * Range-scoped SLA aggregate for Story 12's Reports dashboard.
     *
     * This is the ONLY place a compliance / breach percentage over a date
     * range is derived — the reports endpoint calls this rather than
     * re-implementing threshold logic that could disagree with the Ticket
     * Queue's live indicator.
     *
     * "Resolved in range" = tickets whose `resolved_at` falls in [$from, $to].
     * A ticket with no active rule for its priority has no SLA and is excluded
     * from the rate (never counted compliant), exactly as {@see self::for()}
     * returns null. `avg_resolution_minutes` is measured over every resolved
     * ticket in range regardless of rule.
     *
     * @return array{measured: int, resolved_count: int, compliance_rate: float|null, breach_rate: float|null, avg_resolution_minutes: int|null}
     */
    public function complianceForRange(Carbon $from, Carbon $to): array
    {
        $tickets = Ticket::query()
            ->whereNotNull('resolved_at')
            ->whereBetween('resolved_at', [$from, $to])
            ->get();

        $resolvedCount = $tickets->count();

        $withSla = $tickets
            ->map(fn (Ticket $t) => $this->for($t))
            ->filter(fn (?array $sla) => $sla !== null);

        $measured = $withSla->count();

        $complianceRate = null;
        $breachRate = null;
        if ($measured > 0) {
            $breached = $withSla->filter(fn (array $sla) => $sla['risk'] === 'breached')->count();
            $breachRate = round($breached / $measured * 100, 1);
            $complianceRate = round(100 - $breachRate, 1);
        }

        $avgResolution = null;
        if ($resolvedCount > 0) {
            $totalMinutes = $tickets->sum(
                fn (Ticket $t) => $t->created_at->diffInMinutes($t->resolved_at)
            );
            $avgResolution = (int) round($totalMinutes / $resolvedCount);
        }

        return [
            'measured' => $measured,
            'resolved_count' => $resolvedCount,
            'compliance_rate' => $complianceRate,
            'breach_rate' => $breachRate,
            'avg_resolution_minutes' => $avgResolution,
        ];
    }

    /** True when the ticket is currently at_risk or breached (open work only). */
    public function isAtRisk(Ticket $ticket, ?Carbon $now = null): bool
    {
        $sla = $this->for($ticket, $now);

        return $sla !== null && in_array($sla['risk'], ['at_risk', 'breached'], true);
    }

    private function asCarbon(mixed $value): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        return $value instanceof Carbon ? $value->copy() : Carbon::parse($value);
    }

    private function ruleForPriority(string $priority): ?SlaRule
    {
        return $this->ruleCache[$priority] ??= SlaRule::query()
            ->where('priority', $priority)
            ->where('is_active', true)
            ->first();
    }
}
