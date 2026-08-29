<?php

namespace App\Http\Resources;

use App\Enums\CsatSurveyState;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 13 — the PUBLIC survey shape, served to an unauthenticated customer
 * through a signed link.
 *
 * It exposes only what the survey page needs: the derived `state`, a bare
 * ticket reference (number + subject), and — once answered — the recorded
 * response. It must NEVER leak internal notes, assignee, customer record,
 * ticket history, or the internal `id`. That is why this is a separate
 * resource from {@see TicketCsatResource}.
 */
class CsatSurveyResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $state = $this->state;
        $answered = $state === CsatSurveyState::Answered;

        return [
            'state' => $state->value,
            'ticket' => [
                'number' => '#'.$this->ticket_id,
                'subject' => $this->ticket->subject,
            ],
            'rating' => $answered ? $this->rating : null,
            'comment' => $answered ? $this->comment : null,
            'responded_at' => $answered ? $this->responded_at : null,
        ];
    }
}
