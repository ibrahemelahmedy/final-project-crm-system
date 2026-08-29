<?php

namespace App\Services;

use App\Enums\Channel;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Story 12 (WIS-7) — the single aggregation layer for the management Reports
 * dashboard.
 *
 * One method per widget block; every block honours the same [$from, $to]
 * bounds, which is structurally what guarantees no two widgets on the page can
 * show a different range. SLA figures are delegated to {@see SlaCalculator}
 * (Story 06's source of truth) and never recomputed here.
 *
 * Figures are computed on request against indexed queries — no materialised
 * rollup table, no scheduled job (see the story plan's Aggregation decision).
 *
 * Each block sets `available: false` when its own underlying row count for the
 * range is zero, so the widget renders an Empty state instead of a `0%` that
 * reads like a measurement.
 */
class ReportAggregator
{
    /** The artboard's "Target: 90%" line — not a per-rule field today. */
    public const SLA_TARGET_RATE = 90.0;

    public function __construct(private readonly SlaCalculator $sla)
    {
    }

    public function summary(Carbon $from, Carbon $to): array
    {
        return [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'ticket_volume' => $this->ticketVolume($from, $to),
            'sla' => $this->slaBlock($from, $to),
            'channels' => $this->channels($from, $to),
            'agents' => $this->agents($from, $to),
            'csat' => $this->csat($from, $to),
        ];
    }

    /**
     * Story 13 supplies this. Aggregates over `csat_surveys` rows that carry a
     * rating (`whereNotNull('rating')`), bucketed by the range on the copied
     * `resolved_at`. A period with zero responses is "no data" — `available:
     * false` with the same `reason` marker Story 12 already renders, never a
     * score of 0. The block shape is unchanged; the `average` / `by_agent`
     * keys appear only when `available` is true.
     */
    private function csat(Carbon $from, Carbon $to): array
    {
        $responses = CsatSurvey::query()
            ->whereNotNull('rating')
            ->whereBetween('resolved_at', [$from, $to])
            ->get(['resolved_by', 'rating']);

        if ($responses->isEmpty()) {
            return ['available' => false, 'reason' => 'not_collected'];
        }

        $resolverIds = $responses->pluck('resolved_by')->filter()->unique()->all();
        $names = User::query()->whereIn('id', $resolverIds)->pluck('name', 'id');

        $byAgent = $responses
            ->groupBy(fn ($r) => $r->resolved_by ?? 0)
            ->map(function ($rows, $userId) use ($names) {
                return [
                    'user_id' => $userId === 0 ? null : (int) $userId,
                    // A deleted resolver (`resolved_by` nulled on delete) is
                    // bucketed as "unattributed", never dropped from the mean.
                    'name' => $userId === 0 ? 'Unattributed' : ($names[$userId] ?? 'Unknown'),
                    'response_count' => $rows->count(),
                    'average' => round($rows->avg('rating'), 2),
                ];
            })
            ->sortByDesc('response_count')
            ->values()
            ->all();

        return [
            'available' => true,
            'reason' => null,
            'average' => round($responses->avg('rating'), 2),
            'response_count' => $responses->count(),
            'by_agent' => $byAgent,
        ];
    }

    private function ticketVolume(Carbon $from, Carbon $to): array
    {
        $created = $this->countByDay('created_at', $from, $to);
        $resolved = $this->countByDay('resolved_at', $from, $to);

        $points = [];
        for ($day = $from->copy()->startOfDay(); $day->lte($to); $day->addDay()) {
            $key = $day->toDateString();
            $points[] = [
                'date' => $key,
                'created' => (int) ($created[$key] ?? 0),
                'resolved' => (int) ($resolved[$key] ?? 0),
            ];
        }

        $available = $created->sum() > 0 || $resolved->sum() > 0;

        return ['available' => $available, 'points' => $available ? $points : []];
    }

    /** @return Collection<string, int> day (Y-m-d) => count */
    private function countByDay(string $column, Carbon $from, Carbon $to): Collection
    {
        return Ticket::query()
            ->whereNotNull($column)
            ->whereBetween($column, [$from, $to])
            ->selectRaw('DATE('.$column.') as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd');
    }

    private function slaBlock(Carbon $from, Carbon $to): array
    {
        $agg = $this->sla->complianceForRange($from, $to);

        return [
            'available' => $agg['resolved_count'] > 0,
            'compliance_rate' => $agg['compliance_rate'],
            'target_rate' => self::SLA_TARGET_RATE,
            'breach_rate' => $agg['breach_rate'],
            'avg_resolution_minutes' => $agg['avg_resolution_minutes'],
        ];
    }

    private function channels(Carbon $from, Carbon $to): array
    {
        $counts = Ticket::query()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('channel, COUNT(*) as c')
            ->groupBy('channel')
            ->pluck('c', 'channel');

        $total = (int) $counts->sum();

        if ($total === 0) {
            return ['available' => false, 'items' => []];
        }

        // Categories come from Story 04's Channel enum — a channel added there
        // appears here with no code change in this story.
        $items = [];
        foreach (Channel::cases() as $channel) {
            $count = (int) ($counts[$channel->value] ?? 0);
            if ($count === 0) {
                continue; // a zero-count channel is omitted, never shown at 0%
            }
            $items[] = [
                'channel' => $channel->value,
                'label' => $channel->label(),
                'count' => $count,
                'percent' => round($count / $total * 100, 1),
            ];
        }

        usort($items, fn ($a, $b) => $b['count'] <=> $a['count']);

        return ['available' => true, 'items' => $items];
    }

    private function agents(Carbon $from, Carbon $to): array
    {
        $resolved = Ticket::query()
            ->whereNotNull('resolved_at')
            ->whereNotNull('assigned_to')
            ->whereBetween('resolved_at', [$from, $to])
            ->get(['id', 'assigned_to', 'created_at', 'first_response_at']);

        if ($resolved->isEmpty()) {
            // Tickets created but none resolved in range lands here: agent
            // performance is not available rather than reporting 0m.
            return ['available' => false, 'items' => []];
        }

        $users = User::query()
            ->whereIn('id', $resolved->pluck('assigned_to')->unique()->all())
            ->get(['id', 'name', 'is_active'])
            ->keyBy('id');

        $items = $resolved
            ->groupBy('assigned_to')
            ->map(function (Collection $rows, $userId) use ($users) {
                $user = $users->get($userId);

                $responded = $rows->filter(fn (Ticket $t) => $t->first_response_at !== null);
                $avgResponse = $responded->isEmpty()
                    ? null
                    : (int) round(
                        $responded->sum(
                            fn (Ticket $t) => $t->created_at->diffInMinutes(Carbon::parse($t->first_response_at))
                        ) / $responded->count()
                    );

                return [
                    'user_id' => (int) $userId,
                    // A deactivated agent's historical rows still count for the
                    // period they worked; the row renders with the marker.
                    'name' => $user?->name ?? 'Unknown',
                    'deactivated' => $user ? ! $user->is_active : false,
                    'resolved' => $rows->count(),
                    'avg_response_minutes' => $avgResponse,
                ];
            })
            ->sortByDesc('resolved')
            ->values()
            ->all();

        return ['available' => true, 'items' => $items];
    }
}
