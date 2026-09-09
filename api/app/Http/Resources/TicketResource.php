<?php

namespace App\Http\Resources;

use App\Enums\Priority;
use App\Models\Ticket;
use App\Services\SlaClock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => '#'.$this->id,
            'subject' => $this->subject,
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'category' => $this->category,
            'category_label' => Ticket::categoryLabel($this->category),
            // Story 24 (WIS-23). null when the ticket was never classified
            // (provider failure or the feature off) — which is distinct from
            // classified-but-ambiguous, where `suggestion` is null and
            // `needs_triage` is true.
            'ai_classification' => $this->ai_classified_at === null ? null : [
                'suggested_category' => $this->ai_suggested_category,
                'suggested_category_label' => $this->ai_suggested_category
                    ? Ticket::categoryLabel($this->ai_suggested_category) : null,
                'suggested_priority' => $this->ai_suggested_priority,
                'suggested_priority_label' => $this->ai_suggested_priority
                    ? Priority::from($this->ai_suggested_priority)->label() : null,
                'confidence' => $this->ai_confidence,
                'needs_triage' => (bool) $this->needs_triage,
                'classified_at' => $this->ai_classified_at,
            ],
            'channel' => $this->channel->value,
            'channel_label' => $this->channel->label(),
            'customer' => $this->customer ? [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
            ] : null,
            'assignee' => $this->assignee ? [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
                'initials' => $this->assignee->initials(),
            ] : null,
            'created_by' => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null,
            // Story 06 fills the values; the keys are fixed and never change.
            //
            // snapshot() reads only columns already on this ticket row, so a
            // 25-row page costs no extra query. app() resolves the singleton —
            // a JsonResource has no constructor injection.
            'sla' => app(SlaClock::class)->snapshot($this->resource),
            'resolved_at' => $this->resolved_at,
            'closed_at' => $this->closed_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
