<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            // Falls back to the author_name snapshot when the author's
            // account has since been deleted — no author email either way.
            'author' => [
                'id' => $this->user_id,
                'name' => $this->author?->name ?? $this->author_name,
            ],
            'created_at' => $this->created_at,
        ];
    }
}
