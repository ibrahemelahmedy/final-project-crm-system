<?php

namespace App\Observers;

use App\Enums\TicketStatus;
use App\Mail\CsatInvitationMail;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Services\CsatShareLink;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

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
 *
 * Story 23 (WIS-27) adds the CSAT invitation email. Because the observer runs
 * inside the resolving transaction, the send is deferred with DB::afterCommit
 * (Decision 4) — it never fires on rollback — and capped per request
 * (Decision 5) so a 100-ticket bulk resolve does not do 100 synchronous SMTP
 * round-trips.
 */
class TicketResolutionObserver
{
    /**
     * Per-process (= per-request in PHP-FPM, per-command in artisan) count of
     * CSAT invitations sent. There is no queue worker or Octane here, so this
     * never needs resetting in production; tests reset it explicitly.
     */
    private static int $sentThisRequest = 0;

    public static function resetInvitationCounter(): void
    {
        self::$sentThisRequest = 0;
    }

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
            $survey = CsatSurvey::create([
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

            return;
        }

        $this->queueInvitation($survey);
    }

    /**
     * Story 23 (WIS-27). Registered ONLY on the path that actually created a
     * survey — never on the outstanding early-return, never on the
     * unique-violation swallow. One created survey, at most one email.
     */
    private function queueInvitation(CsatSurvey $survey): void
    {
        $survey->loadMissing('ticket.customer');
        $email = $survey->ticket?->customer?->email;

        if ($email === null) {
            return; // ADR-005: a phone-only customer has no delivery channel.
        }

        $cap = (int) config('mail.csat.max_per_request');

        if (++self::$sentThisRequest > $cap) {
            Log::warning('CSAT invitation skipped: per-request cap reached.', [
                'survey_id' => $survey->id,
                'cap' => $cap,
            ]);

            return;
        }

        DB::afterCommit(function () use ($survey, $email) {
            try {
                Mail::to($email)->send(new CsatInvitationMail(
                    $survey,
                    app(CsatShareLink::class)->for($survey),
                ));
            } catch (Throwable $e) {
                Log::error('CSAT invitation email failed to send.', [
                    'survey_id' => $survey->id,
                    'exception' => $e::class,
                    'message' => $e->getMessage(),
                ]);
            }
        });
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }
}
