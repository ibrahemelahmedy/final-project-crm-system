<?php

namespace App\Http\Resources;

use App\Services\AuditTrail;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One audit row for the viewer. Read-only by construction — there is no
 * corresponding write shape anywhere, and no route accepts one.
 *
 * `audit_logs.user_id` is nullOnDelete, so the actor block falls back to the
 * retained `email` rather than rendering a blank cell.
 */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $context = $this->context ?? [];

        return [
            'id' => $this->id,
            'event' => $this->event,
            'event_label' => AuditTrail::label($this->event),
            'actor' => [
                'id' => $this->user_id,
                // A deleted actor keeps its email; the viewer shows that
                // rather than an empty cell.
                'name' => $this->whenLoaded('user', fn () => $this->user?->name) ?: ($this->email ?: 'Unknown'),
                'email' => $this->email,
            ],
            'target' => [
                'type' => $context['target_type'] ?? null,
                'id' => $context['target_id'] ?? null,
                'label' => $context['target_label'] ?? null,
            ],
            'ip_address' => $this->ip_address,
            'context' => $context,
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
