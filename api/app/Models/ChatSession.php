<?php

namespace App\Models;

use Database\Factories\ChatSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 26 (WIS-22), Decision 11. One row per anonymous chat-widget visitor.
 * Deliberately NOT Sanctum, NOT portal_sessions — a chat_sessions token is
 * structurally incapable of authenticating a staff OR a portal route.
 */
class ChatSession extends Model
{
    /** @use HasFactory<ChatSessionFactory> */
    use HasFactory;

    protected $fillable = [
        'channel_connection_id', 'token_hash', 'customer_id', 'ticket_id',
        'visitor_name', 'visitor_email', 'origin', 'message_count',
        'last_seen_message_id', 'expires_at', 'last_used_at', 'revoked_at', 'user_agent',
    ];

    /** Never serialised — the hash has no reader outside ChatWidgetAuth's own lookup. */
    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(ChannelConnection::class, 'channel_connection_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function isLive(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    /** The one hashing site — called by both the issuing path and ChatWidgetAuth's lookup. */
    public static function hashToken(string $plaintext): string
    {
        return hash('sha256', $plaintext);
    }
}
