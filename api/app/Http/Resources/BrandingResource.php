<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Deliberately no `logo_path` key — the on-disk path is an internal detail
 * and leaking it invites a client to build its own URL (Story 20, Task 8).
 */
class BrandingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'primary_color' => $this['primary_color'],
            'logo_url' => $this['logo_url'],
            'updated_at' => $this['updated_at'],
        ];
    }
}
