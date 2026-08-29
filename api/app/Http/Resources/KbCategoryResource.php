<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A left-rail category (Story 09). `article_count` is whatever the caller
 * counted — the controller counts only what the CALLER may see, so an Agent's
 * rail never totals in a draft.
 */
class KbCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'article_count' => (int) ($this->articles_count ?? 0),
        ];
    }
}
