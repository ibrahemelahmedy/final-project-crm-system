<?php

namespace App\Http\Resources;

use App\Enums\CsatSurveyState;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Services\CsatShareLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 17 (WIS-16, Customer Portal). The customer-visible projection of a
 * ticket — a NEW resource, not a stripped-down TicketResource, so an
 * internal field can never leak through a forgotten `when()`. Frozen keys:
 * no `sla`, `assigned_to`, `priority`, `created_by`, or any internal id
 * other than the ticket's own.
 *
 * @property Ticket $resource
 */
class PortalTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject' => $this->subject,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'category' => $this->category,
            'category_label' => Ticket::categoryLabel($this->category),
            'channel' => $this->channel->value,
            'channel_label' => $this->channel->label(),
            'created_at' => $this->created_at,
            'last_activity_at' => $this->updated_at,
            'resolved_at' => $this->resolved_at,
            'closed_at' => $this->closed_at,
            'message_count' => $this->whenCounted('messages'),
            'feedback_url' => $this->feedbackUrl(),
        ];
    }

    private function feedbackUrl(): ?string
    {
        $survey = CsatSurvey::query()
            ->where('ticket_id', $this->id)
            ->orderByDesc('resolution_cycle')
            ->first();

        if ($survey === null || $survey->state !== CsatSurveyState::Outstanding) {
            return null;
        }

        return app(CsatShareLink::class)->for($survey);
    }
}
