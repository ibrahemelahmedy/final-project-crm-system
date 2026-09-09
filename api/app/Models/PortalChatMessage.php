<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 24 (WIS-23), Decision 6. One row per chatbot turn.
 */
class PortalChatMessage extends Model
{
    public const ROLE_CUSTOMER = 'customer';

    public const ROLE_ASSISTANT = 'assistant';

    protected $fillable = [
        'portal_chat_conversation_id', 'role', 'body', 'citations',
        'input_tokens', 'output_tokens',
    ];

    protected function casts(): array
    {
        return [
            'citations' => 'array',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(PortalChatConversation::class, 'portal_chat_conversation_id');
    }
}
