<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 25 (WIS-24). `payload` is deliberately absent — it carries customer
 * PII and there is no admin need to read it in the UI.
 */
class OutboxMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event->value,
            'event_id' => $this->event_id,
            'status' => $this->status->value,
            'attempts' => $this->attempts,
            'last_status' => $this->last_status,
            'last_error_key' => $this->last_error_key,
            'next_attempt_at' => $this->next_attempt_at?->toJSON(),
            'delivered_at' => $this->delivered_at?->toJSON(),
            'failed_at' => $this->failed_at?->toJSON(),
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
