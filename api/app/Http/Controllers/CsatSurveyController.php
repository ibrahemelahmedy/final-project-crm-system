<?php

namespace App\Http\Controllers;

use App\Enums\CsatSurveyState;
use App\Http\Requests\StoreCsatResponseRequest;
use App\Http\Resources\CsatSurveyResource;
use App\Http\Resources\TicketCsatResource;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Story 13 (CSAT Collection / WIS-14).
 *
 * - `show` / `store` are PUBLIC (no session), gated by a signed, expiring URL
 *   and an IP-keyed rate limiter. They never distinguish "expired" from
 *   "tampered" from "unknown uuid" — every one renders the same calm invalid
 *   card, so the link space is not enumerable.
 * - `showForTicket` is the agent-facing read; it authorises through
 *   TicketPolicy@view and mints a fresh share link.
 */
class CsatSurveyController extends Controller
{
    use AuthorizesRequests;

    /** The public identical-for-every-failure body. */
    private function invalidBody(): array
    {
        return [
            'state' => CsatSurveyState::Expired->value,
            'ticket' => null,
            'rating' => null,
            'comment' => null,
            'responded_at' => null,
        ];
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $survey = CsatSurvey::with('ticket:id,subject')->where('uuid', $uuid)->first();

        if ($survey === null || $survey->state === CsatSurveyState::Expired) {
            return response()->json($this->invalidBody());
        }

        return (new CsatSurveyResource($survey))->response();
    }

    public function store(StoreCsatResponseRequest $request, string $uuid): JsonResponse
    {
        $survey = CsatSurvey::with('ticket:id,subject')->where('uuid', $uuid)->first();

        if ($survey === null || $survey->state === CsatSurveyState::Expired) {
            return response()->json($this->invalidBody());
        }

        // The same link submitted twice: a conditional update guarded by
        // `whereNull('responded_at')` inside a transaction. The second write
        // touches zero rows and we return the already-answered state — never
        // an error, never an overwrite.
        DB::transaction(function () use ($survey, $request) {
            $affected = CsatSurvey::query()
                ->whereKey($survey->getKey())
                ->whereNull('responded_at')
                ->update([
                    'rating' => (int) $request->validated('rating'),
                    'comment' => $request->validated('comment'),
                    'responded_at' => now(),
                ]);

            if ($affected > 0) {
                $survey->refresh();
            }
        });

        $survey->refresh()->loadMissing('ticket:id,subject');

        return (new CsatSurveyResource($survey))->response();
    }

    public function showForTicket(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);

        $survey = CsatSurvey::query()
            ->where('ticket_id', $ticket->id)
            ->orderByDesc('resolution_cycle')
            ->first();

        if ($survey === null) {
            return response()->json(['state' => 'none']);
        }

        $this->authorize('view', $survey);

        $survey->setAttribute('share_url', $this->shareUrl($survey));

        return (new TicketCsatResource($survey))->response();
    }

    /**
     * The customer-facing link points at the SPA route `/feedback/{uuid}`; the
     * SPA forwards the `expires` + `signature` query params to `GET
     * /api/csat/{uuid}`. Keyed on route names `csat.show` / `csat.store` —
     * renaming either invalidates every outstanding link.
     */
    private function shareUrl(CsatSurvey $survey): string
    {
        $signed = URL::temporarySignedRoute(
            'csat.show',
            $survey->expires_at,
            ['uuid' => $survey->uuid]
        );

        $query = parse_url($signed, PHP_URL_QUERY);
        $frontend = trim(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))[0]);

        return rtrim($frontend, '/')."/feedback/{$survey->uuid}?{$query}";
    }
}
