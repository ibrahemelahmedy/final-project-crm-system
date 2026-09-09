<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

/**
 * Story 24 (WIS-23). The "ignore this suggestion" half of Decision 4. There is
 * no APPLY endpoint: applying is PATCH /api/tickets/{id} with the suggested
 * values, which already runs TicketPolicy@update and already writes
 * category_changed / priority_changed to ticket_events.
 */
class TicketClassificationController extends Controller
{
    use AuthorizesRequests;

    public function destroy(Ticket $ticket): JsonResponse
    {
        $this->authorize('update', $ticket);

        Ticket::query()->whereKey($ticket->id)->toBase()->update([
            'ai_suggested_category' => null,
            'ai_suggested_priority' => null,
            'needs_triage' => false,
            'updated_at' => $ticket->updated_at,
        ]);

        return response()->json([], 204);
    }
}
