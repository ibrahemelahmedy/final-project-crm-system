<?php

namespace App\Http\Resources;

use App\Models\KbArticle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 17 (WIS-16, Customer Portal). No `author`, no `body` (raw Markdown),
 * no `view_count`, no `versions_count`, no `status` — the client renders
 * only `body_html`, sanitized by App\Services\MarkdownRenderer.
 *
 * @property KbArticle $resource
 */
class PortalArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'body_html' => $this->body_html,
            'published_at' => $this->published_at,
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
        ];
    }
}
