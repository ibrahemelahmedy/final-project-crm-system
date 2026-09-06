<?php

namespace App\Http\Controllers;

use App\Enums\AssistKind;
use App\Exceptions\AssistUnavailableException;
use App\Http\Resources\AiAssistArtifactResource;
use App\Models\Ticket;
use App\Services\Ai\TicketAssist;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Story 19 (WIS-18, AI Assist). `TicketPolicy@view` is the boundary on all
 * four actions, exactly as CsatSurveyController@showForTicket uses it.
 */
class TicketAssistController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private TicketAssist $assist) {}

    /** Cached artefacts only. Never generates, never bills. */
    public function show(Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);

        return response()->json([
            'enabled' => (bool) config('ai.enabled'),
            'summary' => $this->resource($ticket, AssistKind::Summary),
            'suggestion' => $this->resource($ticket, AssistKind::SuggestedReply),
        ]);
    }

    public function summary(Request $request, Ticket $ticket): JsonResponse
    {
        return $this->run($request, $ticket, AssistKind::Summary);
    }

    public function reply(Request $request, Ticket $ticket): JsonResponse
    {
        return $this->run($request, $ticket, AssistKind::SuggestedReply);
    }

    public function dismiss(Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);
        $this->assist->dismiss($ticket);

        return response()->json([], 204);
    }

    private function run(Request $request, Ticket $ticket, AssistKind $kind): JsonResponse
    {
        $this->authorize('view', $ticket);

        if (! config('ai.enabled')) {
            return response()->json(['message' => __('ai.unavailable')], 503);
        }

        try {
            $artifact = $this->assist->generate($ticket, $kind, $request->user());
        } catch (AssistUnavailableException $e) {
            report($e); // the provider's reason is logged, never returned

            return response()->json(['message' => __('ai.failed')], 503);
        }

        // Not ->response(): a JsonResource auto-selects 201 when the
        // underlying model `wasRecentlyCreated` — true on the FIRST
        // generate for a ticket, false on every regenerate. Both are a
        // successful generation from the caller's point of view, so this
        // route always answers 200, whether it created or replaced the row.
        return response()->json((new AiAssistArtifactResource($artifact))->resolve());
    }

    private function resource(Ticket $ticket, AssistKind $kind): ?AiAssistArtifactResource
    {
        $artifact = $this->assist->existing($ticket, $kind);

        return $artifact ? new AiAssistArtifactResource($artifact) : null;
    }
}
