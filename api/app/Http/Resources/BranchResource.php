<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'region' => $this->region,
            'timezone' => $this->timezone,
            'is_active' => $this->is_active,
            // withCount('users') in the controller; `?? 0` so the key never
            // vanishes if a caller forgets the count.
            'agent_count' => $this->users_count ?? 0,
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
