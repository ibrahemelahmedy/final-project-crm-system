<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            // The table's BRANCH column reads this directly — the client
            // never joins.
            'branch_name' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'name' => $this->name,
            'is_active' => $this->is_active,
            'agent_count' => $this->users_count ?? 0,
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
