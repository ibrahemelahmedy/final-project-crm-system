<?php

namespace App\Http\Resources;

use App\Models\PortalChatConversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 24 (WIS-23). The customer-visible projection of a chat conversation.
 * The two "remaining" figures are computed server-side so the SPA never
 * re-derives a ceiling.
 *
 * @property PortalChatConversation $resource
 */
class PortalChatConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $maxMessages = (int) config('ai.chat.max_messages');
        $maxTokens = (int) config('ai.chat.max_tokens_per_conversation');

        return [
            'id' => $this->id,
            'state' => $this->state->value,
            'message_count' => $this->message_count,
            'messages_remaining' => max(0, $maxMessages - $this->message_count),
            'tokens_remaining' => max(0, $maxTokens - $this->totalTokens()),
            'escalated_ticket_id' => $this->escalated_ticket_id,
            'created_at' => $this->created_at,
        ];
    }
}
