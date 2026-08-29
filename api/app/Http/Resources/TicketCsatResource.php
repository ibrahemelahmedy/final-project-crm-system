<?php

namespace App\Http\Resources;

use App\Enums\CsatSurveyState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 13 — the AGENT-facing shape for GET /api/tickets/{ticket}/csat.
 *
 * Includes the freshly minted `share_url` (the copy-link affordance) and the
 * recorded response so the ticket-detail panel can show it read-only. The
 * caller has already passed TicketPolicy@view, so the comment is safe to
 * return here — unlike the public resource, which serves a stranger.
 *
 * `share_url` is set on the model instance by the controller before wrapping.
 */
class TicketCsatResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $state = $this->state;
        $answered = $state === CsatSurveyState::Answered;

        return [
            'state' => $state->value,
            'resolution_cycle' => $this->resolution_cycle,
            'resolved_at' => $this->resolved_at,
            'expires_at' => $this->expires_at,
            'share_url' => $this->share_url,
            'rating' => $answered ? $this->rating : null,
            'comment' => $answered ? $this->comment : null,
            'responded_at' => $answered ? $this->responded_at : null,
        ];
    }
}
