<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QuickReplyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            // Single-line truncated preview for the library table — the
            // artboard's PREVIEW column. The full body lives in the edit modal.
            'preview' => str($this->body)->limit(80)->value(),
            'category' => $this->category,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'created_by' => $this->creator?->name,
            'updated_by' => $this->updater?->name,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
