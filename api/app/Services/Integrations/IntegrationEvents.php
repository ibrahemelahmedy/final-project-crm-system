<?php

namespace App\Services\Integrations;

use App\Enums\IntegrationEvent;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationType;
use App\Enums\OutboxStatus;
use App\Models\CsatSurvey;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Models\Ticket;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Story 25 (WIS-24), Decision 2 & 4. The enqueue seam. Writes ONE outbox row
 * inside the caller's transaction (never afterCommit around the insert
 * itself — that is the whole point of the outbox pattern), then defers a
 * best-effort inline delivery attempt.
 */
final class IntegrationEvents
{
    /** Attempts inline-delivered this process. Bounded by Decision 2. Reset in TestCase::setUp(). */
    private static int $attemptedThisRequest = 0;

    public static function resetInlineCounter(): void
    {
        self::$attemptedThisRequest = 0;
    }

    /**
     * Never throws: an enqueue failure must not fail the ticket resolve (or
     * CSAT submit) that triggered it.
     *
     * `$payload` is a Closure, NOT a built array — building the envelope
     * (Task 21's payload builders) can touch relations (loadMissing) on the
     * caller's model, and INTEGRATION_SYNC_ENABLED is false for the whole
     * suite precisely so nothing outside this feature is touched when sync
     * is off. Evaluating the payload eagerly as a plain array argument would
     * run that relation load on every ticket create regardless of the flag —
     * so it is built lazily, only once every early-return guard below has
     * passed.
     */
    public function record(IntegrationEvent $event, string $eventId, \Closure $payload): void
    {
        try {
            $this->doRecord($event, $eventId, $payload);
        } catch (Throwable $e) {
            Log::error('Outbound integration event enqueue failed.', [
                'event' => $event->value,
                'exception' => $e::class,
            ]);
        }
    }

    private function doRecord(IntegrationEvent $event, string $eventId, \Closure $payload): void
    {
        if (! config('integrations.sync.enabled')) {
            return;
        }

        // "Nothing configured" fast path — one query.
        $integration = Integration::query()
            ->where('type', IntegrationType::Erp->value)
            ->where('outbound_enabled', true)
            ->where('status', IntegrationStatus::Connected->value)
            ->first();

        if ($integration === null) {
            return;
        }

        if (! in_array($event->value, (array) $integration->outbound_events, true)) {
            return;
        }

        if (blank($integration->outbound_url)) {
            return;
        }

        $envelope = [
            'event' => $event->value,
            'event_id' => $eventId,
            'occurred_at' => now()->toJSON(),
            ...$payload(),
        ];

        try {
            // A nested transaction (a Postgres SAVEPOINT, since the caller's
            // resolve/create transaction is already open) so a unique
            // violation here does not poison the caller's outer transaction.
            $message = DB::transaction(fn () => IntegrationOutboxMessage::create([
                'integration_id' => $integration->id,
                'event' => $event->value,
                'event_id' => $eventId,
                'payload' => $envelope,
                'status' => OutboxStatus::Pending->value,
                'attempts' => 0,
                'next_attempt_at' => null,
            ]));
        } catch (QueryException $e) {
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            return; // double-enqueue is impossible — the unique index already has this row.
        }

        $id = $message->id;

        if (++self::$attemptedThisRequest > (int) config('integrations.sync.outbound.inline_max_per_request')) {
            return; // the scheduled drain will pick it up. Never log the payload.
        }

        // The seeder must perform zero outbound requests. The enqueue itself
        // (above) is harmless and keeps `migrate:fresh --seed` honest if an
        // integration is ever configured before seeding.
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        DB::afterCommit(function () use ($id) {
            app()->terminating(function () use ($id) {
                try {
                    // No $processed id-set needed here — attempt() re-reads
                    // the row and no-ops unless it is still `pending`, which
                    // is a stronger guard than the id-set
                    // TicketClassificationObserver.php:22-31 needed.
                    $message = IntegrationOutboxMessage::find($id);

                    if ($message !== null && $message->status === OutboxStatus::Pending) {
                        app(OutboxDispatcher::class)->attempt($message);
                    }
                } catch (Throwable $e) {
                    Log::error('Outbound integration event delivery failed.', [
                        'id' => $id,
                        'exception' => $e::class,
                    ]);
                }
            });
        });
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }

    public static function ticketPayload(Ticket $ticket): array
    {
        $maxChars = (int) config('integrations.sync.outbound.payload_max_chars');
        // Full relation, not a column-restricted one: loadMissing() caches
        // whatever it loads on the model, and a caller elsewhere in the same
        // request may still read other columns (e.g. ->customer->tier) off
        // this same Ticket instance afterwards.
        $ticket->loadMissing('customer');

        return [
            'id' => $ticket->id,
            'subject' => $ticket->subject,
            'status' => $ticket->status->value,
            'priority' => $ticket->priority->value,
            'category' => $ticket->category,
            'channel' => $ticket->channel->value,
            'created_at' => $ticket->created_at?->toJSON(),
            'resolved_at' => $ticket->resolved_at?->toJSON(),
            'description' => Str::limit((string) $ticket->description, $maxChars),
            'customer' => $ticket->customer === null ? null : [
                'id' => $ticket->customer->id,
                'name' => $ticket->customer->name,
                'email' => $ticket->customer->email,
                'external_id' => $ticket->customer->external_id,
            ],
        ];
    }

    public static function csatPayload(CsatSurvey $survey): array
    {
        $maxChars = (int) config('integrations.sync.outbound.payload_max_chars');

        return [
            'survey_uuid' => $survey->uuid,
            'ticket_id' => $survey->ticket_id,
            'rating' => $survey->rating,
            'comment' => $survey->comment === null ? null : Str::limit($survey->comment, $maxChars),
            'responded_at' => $survey->responded_at?->toJSON(),
        ];
    }
}
