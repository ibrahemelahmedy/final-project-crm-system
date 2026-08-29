<?php

namespace App\Http\Resources;

use App\Models\Ticket;
use App\Services\QuickReplyRenderer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `GET /api/tickets/{ticket}/quick-replies` — the picker's data shape.
 * Carries BOTH the raw template and the rendered text, so the picker can
 * show the `{{…}}` badge in the list (design export) while inserting the
 * already-resolved `body_rendered` into the composer.
 */
class TicketQuickReplyResource extends JsonResource
{
    public function __construct(
        $resource,
        private readonly Ticket $ticket,
    ) {
        parent::__construct($resource);
    }

    public function toArray(Request $request): array
    {
        $renderer = app(QuickReplyRenderer::class);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category,
            'body_template' => $this->body,
            'body_rendered' => $renderer->render($this->resource, $this->ticket, $request->user()),
        ];
    }
}
