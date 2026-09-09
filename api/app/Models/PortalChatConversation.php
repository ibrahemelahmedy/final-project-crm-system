<?php

namespace App\Models;

use App\Enums\PortalChatState;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Story 24 (WIS-23), Decision 6. One live chatbot conversation per portal
 * session.
 */
class PortalChatConversation extends Model
{
    protected $fillable = [
        'portal_session_id', 'customer_id', 'locale', 'state',
        'message_count', 'input_tokens', 'output_tokens', 'escalated_ticket_id',
    ];

    protected function casts(): array
    {
        return [
            'state' => PortalChatState::class,
            'message_count' => 'integer',
            'input_tokens' => 'integer',
            'output_tokens' => 'integer',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(PortalSession::class, 'portal_session_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function escalatedTicket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'escalated_ticket_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(PortalChatMessage::class)->orderBy('id');
    }

    public function totalTokens(): int
    {
        return $this->input_tokens + $this->output_tokens;
    }

    /** Decision 8's two ceilings, checked BEFORE the provider is called. */
    public function hasCapacity(): bool
    {
        return $this->message_count < (int) config('ai.chat.max_messages')
            && $this->totalTokens() < (int) config('ai.chat.max_tokens_per_conversation');
    }
}
