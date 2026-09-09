<?php

namespace App\Observers;

use App\Models\Ticket;
use App\Services\Ai\TicketClassifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 24 (WIS-23), Decision 2. Propose category + priority on Ticket::created,
 * deferred with DB::afterCommit + app()->terminating() so no creating request
 * waits on the provider. Structure copied from TicketResolutionObserver.
 */
class TicketClassificationObserver
{
    /** Per-process cap, exactly like TicketResolutionObserver::$sentThisRequest:39. */
    private static int $classifiedThisRequest = 0;

    /**
     * Ticket ids whose terminating callback has already fired. Laravel does
     * NOT clear registered terminating callbacks between requests, and the
     * test kernel reuses one app across every request in a test — without this
     * guard one ticket's callback re-classifies on every later request's
     * terminate. In production (one request per process) it is a harmless
     * no-op.
     *
     * @var array<int, int>
     */
    private static array $processed = [];

    public static function resetClassificationCounter(): void
    {
        self::$classifiedThisRequest = 0;
        self::$processed = [];
    }

    public function created(Ticket $ticket): void
    {
        if (! config('ai.enabled') || ! config('ai.classify.enabled')) {
            return;
        }

        // `migrate:fresh --seed` creates 64 tickets in ONE process; without
        // this the console kernel's terminate would fire 64 provider calls.
        // The suite runs under the CLI SAPI too (runningInConsole() is true in
        // a feature test), but there the HTTP-test kernel calls terminate()
        // per request and the seeder never does — so exclude the test process
        // from the console guard, letting postJson() exercise the real path
        // while `$this->seed()` still fires nothing.
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        $cap = (int) config('ai.classify.max_per_request');

        if (++self::$classifiedThisRequest > $cap) {
            Log::warning('AI classification skipped: per-request cap reached.', [
                'ticket_id' => $ticket->id,
                'cap' => $cap,
            ]);

            return;
        }

        $id = $ticket->id;

        // afterCommit: TicketController@store runs OUTSIDE a transaction
        // (:91) but PortalRequestController::store() runs INSIDE one (:105).
        // terminating: run after $response->send(), so no caller waits on the
        // provider. Laravel's test kernel calls terminate(), so this IS
        // exercised by feature tests.
        DB::afterCommit(function () use ($id) {
            app()->terminating(function () use ($id) {
                if (in_array($id, self::$processed, true)) {
                    return;
                }
                self::$processed[] = $id;

                try {
                    $fresh = Ticket::query()->find($id);

                    if ($fresh !== null) {
                        app(TicketClassifier::class)->classify($fresh);
                    }
                } catch (Throwable $e) {
                    // Nothing downstream of a sent response may 500.
                    Log::error('AI classification failed.', [
                        'ticket_id' => $id,
                        'exception' => $e::class,
                    ]);
                }
            });
        });
    }
}
