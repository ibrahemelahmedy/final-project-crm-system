<?php

namespace App\Observers;

use App\Enums\TicketStatus;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use Illuminate\Database\QueryException;

/**
 * Story 13 (CSAT Collection).
 *
 * Story 04 transitions the ticket status INLINE in TicketController — it emits
 * no domain event — so the CSAT hook is a model observer watching the status
 * become Resolved. It does not re-implement the transition and never writes to
 * `tickets`.
 *
 * The observer fires inside the same transaction as the controller's
 * `$ticket->update(...)`, so a rolled-back resolve leaves no orphan survey.
 */
class TicketResolutionObserver
{
    public function updated(Ticket $ticket): void
    {
        if (! $ticket->wasChanged('status')) {
            return;
        }

        if ($ticket->status !== TicketStatus::Resolved) {
            return;
        }

        $this->createSurveyFor($ticket);
    }

    private function createSurveyFor(Ticket $ticket): void
    {
        // A survey already outstanding for this ticket means the previous
        // resolution cycle was never answered and never expired — re-resolving
        // must NOT mint a second link. The old one stays valid.
        $latest = CsatSurvey::query()
            ->where('ticket_id', $ticket->id)
            ->orderByDesc('resolution_cycle')
            ->first();

        if ($latest !== null && $latest->isOutstanding()) {
            return;
        }

        $nextCycle = ($latest?->resolution_cycle ?? 0) + 1;

        try {
            CsatSurvey::create([
                'ticket_id' => $ticket->id,
                'resolution_cycle' => $nextCycle,
                'resolved_by' => auth()->id(),
                'resolved_at' => $ticket->resolved_at ?? now(),
                'expires_at' => now()->addDays(30),
            ]);
        } catch (QueryException $e) {
            // Two agents resolving concurrently / a double-clicked Resolve
            // button both race for the same (ticket_id, resolution_cycle). The
            // unique index is the real guard; a violation here means the row
            // already exists, which is success, not a 500.
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }
        }
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }
}
