<?php

namespace App\Http\Controllers;

use App\Http\Resources\TicketQuickReplyResource;
use App\Models\QuickReply;
use App\Models\Ticket;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/tickets/{ticket}/quick-replies` — the in-composer picker's data
 * source. ACTIVE templates only, each carrying both the raw template and the
 * server-rendered text (App\Services\QuickReplyRenderer).
 */
class TicketQuickReplyController extends Controller
{
    use AuthorizesRequests;

    public function index(Ticket $ticket): JsonResponse
    {
        $this->authorize('view', $ticket);

        $quickReplies = QuickReply::query()->active()->orderBy('title')->get();

        return response()->json([
            'data' => $quickReplies
                ->map(fn (QuickReply $qr) => (new TicketQuickReplyResource($qr, $ticket))->resolve())
                ->values(),
        ]);
    }
}
