<?php

namespace App\Http\Resources;

use App\Models\PortalChatMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 24 (WIS-23). One chatbot turn as the customer sees it.
 *
 * @property PortalChatMessage $resource
 */
class PortalChatMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'body' => $this->body,
            'citations' => $this->citations ?? [],
            'created_at' => $this->created_at,
        ];
    }
}
