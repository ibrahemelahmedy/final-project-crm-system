<?php

namespace App\Http\Resources;

use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 17 (WIS-16, Customer Portal). No `user_id`, no `visibility` — a
 * customer never sees the field whose other value they are forbidden to
 * read — and no `channel`. The caller MUST have already scoped the query
 * through TicketMessage::scopePublicOnly(); this resource does not filter.
 *
 * @property TicketMessage $resource
 */
class PortalMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author_type' => $this->author_type,
            'author_name' => $this->authorName(),
            'body' => $this->body,
            'created_at' => $this->created_at,
        ];
    }

    private function authorName(): ?string
    {
        return match ($this->author_type) {
            TicketMessage::AUTHOR_AGENT => $this->author?->name,
            TicketMessage::AUTHOR_CUSTOMER => $this->customer?->name,
            default => null,
        };
    }
}
