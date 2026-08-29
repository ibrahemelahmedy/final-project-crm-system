<?php

namespace App\Http\Resources;

use App\Services\MarkdownRenderer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The reader / editor payload (Story 09).
 *
 * `body_html` is the SANITIZED render and is the only field the reader puts in
 * the DOM. `body` is the raw Markdown, present so the editor can round-trip an
 * article — the client must never render it.
 *
 * `toc`, `read_minutes`, and `direction` are all derived from the sanitized
 * HTML by the same MarkdownRenderer that produced it, so the anchors in the
 * table of contents are guaranteed to match ids that actually exist in the
 * body the client received.
 */
class KbArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $markdown = app(MarkdownRenderer::class);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            // Raw Markdown — for the EDITOR only. Never rendered as HTML.
            'body' => $this->body,
            // Sanitized on write. The only field the reader renders.
            'body_html' => $this->body_html,
            'excerpt' => $this->excerpt,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'category' => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ] : null,
            'author' => $this->author ? [
                'id' => $this->author->id,
                'name' => $this->author->name,
            ] : null,
            'view_count' => (int) $this->view_count,
            'published_at' => $this->published_at,
            'created_at' => $this->created_at,
            // The reader's visible "Last updated" staleness signal.
            'updated_at' => $this->updated_at,
            'version_count' => (int) ($this->versions_count ?? 0),
            'read_minutes' => $markdown->readMinutes($this->body_html),
            // Content direction, INDEPENDENT of the app-wide direction: an
            // Arabic article read by an English-UI user still renders RTL,
            // inside the article body only.
            'direction' => $markdown->direction($this->body ?: $this->body_html),
            'toc' => $markdown->toc($this->body_html),
        ];
    }
}
