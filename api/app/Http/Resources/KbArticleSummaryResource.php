<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The list / search / picker shape (Story 09). FROZEN CONTRACT — the
 * ticket-side ArticlePickerPanel and any later "suggested solutions" story
 * consume exactly this. Add optional fields; never rename or drop one.
 *
 * Deliberately WITHOUT `body` or `body_html`: a search result page carrying
 * every article's full body is both a payload problem and a way for a draft's
 * contents to leak through a list endpoint that only meant to leak its title.
 */
class KbArticleSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category?->id,
                'name' => $this->category?->name,
                'slug' => $this->category?->slug,
            ], null),
            'author' => $this->whenLoaded('author', fn () => [
                'id' => $this->author?->id,
                'name' => $this->author?->name,
            ], null),
            'view_count' => (int) $this->view_count,
            'published_at' => $this->published_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
