<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 08 ADDS `department`, `last_login_at`, and `initials`. It renames
 * nothing — Story 01's login response, Story 02's header, and Story 07 all
 * read the existing keys.
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'home_route' => $this->role->homeRoute(),
            'is_active' => $this->is_active,
            'department' => $this->department,
            'locale' => $this->locale ?? 'en',
            'initials' => $this->initials(),
            'last_login_at' => $this->last_login_at?->toJSON(),
        ];
    }
}
