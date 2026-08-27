<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Never add phone_normalized, created_by, or deleted_at — the same
        // reasoning as TicketResource withholding the assignee's email.
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'company' => $this->company,
            'tier' => $this->tier->value,
            'tier_label' => $this->tier->label(),
            'initials' => $this->initials(),
            'open_tickets_count' => (int) ($this->open_tickets_count ?? 0),
            'last_contact_at' => $this->last_contact_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
