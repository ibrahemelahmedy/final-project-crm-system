<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Every dashboard aggregation query. Controllers stay thin: one method here
 * per widget. Story 12 (Reports & Dashboards) reuses this service rather than
 * writing a second aggregation layer.
 *
 * SLA-risk is never re-derived here — {@see SlaClock} is the only
 * threshold authority (Story 06 consolidation point).
 *
 * "Team" scope: until Story 08 introduces a departments/teams table,
 * `User::canSeeTeamQueue()` treats every Team Lead and Administrator as seeing
 * the whole ticket pool. The team name below is therefore a single-team
 * placeholder; Story 08 repoints it.
 */
class DashboardMetrics
{
    public const TEAM_NAME = 'Support Ops';

    /** Days of resolved history the compliance percentage is measured over. */
    private const COMPLIANCE_WINDOW_DAYS = 7;

    public function __construct(private readonly SlaClock $clock)
    {
    }

    // ---- Agent ------------------------------------------------------------

    /** @return array{assigned_count: int, sla_risk_count: int, resolved_today_count: int} */
    public function agentSummary(User $user): array
    {
        $assigned = Ticket::query()
            ->where('assigned_to', $user->id)
            ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value]);

        return [
            'assigned_count' => (clone $assigned)->count(),
            'sla_risk_count' => $this->atRiskTickets($user)->count(),
            'resolved_today_count' => Ticket::query()
                ->where('assigned_to', $user->id)
                ->whereNotNull('resolved_at')
                ->where('resolved_at', '>=', Carbon::now()->startOfDay())
                ->count(),
        ];
    }

    /** Up to $limit open tickets for the caller, most-urgent SLA first. */
    public function agentQueue(User $user, int $limit = 5): Collection
    {
        return $this->decorateSla(
            Ticket::query()
                ->where('assigned_to', $user->id)
                ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value])
                ->with(['customer:id,name', 'assignee:id,name'])
                ->get()
        )
            ->sortBy(fn (Ticket $t) => $t->sla_payload['minutes_left'] ?? PHP_INT_MAX)
            ->take($limit)
            ->values();
    }

    /** Up to $limit of the caller's tickets whose SLA risk is at_risk or breached. */
    public function agentSlaRisk(User $user, int $limit = 5): Collection
    {
        return $this->atRiskTickets($user)
            ->sortBy(fn (Ticket $t) => $t->sla_payload['minutes_left'] ?? PHP_INT_MAX)
            ->take($limit)
            ->values();
    }

    // ---- Team -----------------------------------------------------------

    /** @return array{team_name: string, agent_count: int, open_count: int, escalation_count: int, sla_compliance_pct: float|null} */
    public function teamSummary(): array
    {
        return [
            'team_name' => self::TEAM_NAME,
            'agent_count' => User::query()
                ->where('is_active', true)
                ->whereIn('role', [UserRole::Agent->value, UserRole::TeamLead->value])
                ->count(),
            'open_count' => Ticket::query()
                ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value])
                ->count(),
            'escalation_count' => $this->escalatedTickets()->count(),
            'sla_compliance_pct' => $this->slaCompliancePct(),
        ];
    }

    /** @return array<int, array{user_id: int, name: string, open_count: int}> */
    public function teamWorkload(): array
    {
        $counts = Ticket::query()
            ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value])
            ->whereNotNull('assigned_to')
            ->selectRaw('assigned_to, count(*) as open_count')
            ->groupBy('assigned_to')
            ->pluck('open_count', 'assigned_to');

        return User::query()
            ->where('is_active', true)
            ->whereIn('role', [UserRole::Agent->value, UserRole::TeamLead->value])
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $u) => [
                'user_id' => $u->id,
                'name' => $u->name,
                'open_count' => (int) ($counts[$u->id] ?? 0),
            ])
            ->all();
    }

    /** Escalated tickets, newest breach first, decorated with escalation meta. */
    public function teamEscalations(int $limit = 10): Collection
    {
        return $this->escalatedTickets()
            ->sortBy(fn (Ticket $t) => $t->sla_payload['minutes_left'] ?? PHP_INT_MAX)
            ->take($limit)
            ->values();
    }

    // ---- Admin ---------------------------------------------------------

    /** @return array{user_count: int, active_sla_rule_count: int, audit_log_count: int} */
    public function adminSummary(): array
    {
        return [
            'user_count' => User::query()->where('is_active', true)->count(),
            'active_sla_rule_count' => SlaRule::query()->where('is_active', true)->count(),
            'audit_log_count' => AuditLog::query()->count(),
        ];
    }

    // ---- Shared helpers ----------------------------------------------------

    /**
     * Open/pending tickets for $user whose SLA risk (per {@see SlaClock})
     * is at_risk or breached. Tickets with no active rule for their priority
     * are excluded — never counted as compliant.
     */
    private function atRiskTickets(User $user): Collection
    {
        return $this->decorateSla(
            Ticket::query()
                ->where('assigned_to', $user->id)
                ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value])
                ->with(['customer:id,name', 'assignee:id,name'])
                ->get()
        )->filter(fn (Ticket $t) => in_array($t->sla_payload['risk'] ?? null, ['at_risk', 'breached'], true))
            ->values();
    }

    /**
     * Escalated tickets. Story 06 stores a real `tickets.escalated_at`; when it
     * is populated this reads it directly. Before that engine runs, a breached
     * still-open ticket is the closest honest proxy and the escalation meta is
     * derived (current assignee raised it, at the moment its resolution SLA
     * broke). Acting on an escalation is out of scope — Stories 04/05 own that.
     */
    private function escalatedTickets(): Collection
    {
        $open = $this->decorateSla(
            Ticket::query()
                ->whereIn('status', [TicketStatus::Open->value, TicketStatus::Pending->value])
                ->with(['customer:id,name', 'assignee:id,name'])
                ->get()
        );

        $realEscalations = $open->filter(fn (Ticket $t) => $t->getAttribute('escalated_at') !== null);
        $rows = $realEscalations->isNotEmpty()
            ? $realEscalations
            : $open->filter(fn (Ticket $t) => ($t->sla_payload['risk'] ?? null) === 'breached');

        return $rows->each(function (Ticket $t) {
            $storedEscalatedAt = $t->getAttribute('escalated_at');
            $t->escalated_by_name = $t->assignee?->name ?? 'Unassigned';
            $t->escalated_at = $storedEscalatedAt
                ? (string) $storedEscalatedAt
                : ($t->sla_payload['due_at'] ?? null);
        })->values();
    }

    /** Percent of recently-resolved tickets that beat their resolution SLA, or null. */
    private function slaCompliancePct(): ?float
    {
        $resolved = $this->decorateSla(
            Ticket::query()
                ->whereNotNull('resolved_at')
                ->where('resolved_at', '>=', Carbon::now()->subDays(self::COMPLIANCE_WINDOW_DAYS))
                ->get()
        )->filter(fn (Ticket $t) => $t->sla_payload !== null);

        if ($resolved->isEmpty()) {
            return null;
        }

        $compliant = $resolved->filter(fn (Ticket $t) => $t->sla_payload['risk'] !== 'breached')->count();

        return round($compliant / $resolved->count() * 100, 1);
    }

    /**
     * Attaches the computed SLA payload to each ticket as `sla_payload`.
     *
     * A ticket with no SLA (no stamped target) stays `null` rather than
     * carrying a payload of nulls, so every caller's `!== null` filter keeps
     * meaning "this ticket is measured" — it is never counted compliant.
     */
    private function decorateSla(Collection $tickets): Collection
    {
        return $tickets->each(function (Ticket $t) {
            $snapshot = $this->clock->snapshot($t);
            $t->sla_payload = $snapshot['risk'] === null ? null : $snapshot;
        });
    }
}
