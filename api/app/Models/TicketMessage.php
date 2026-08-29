<?php

namespace App\Models;

use App\Enums\Channel;
use App\Enums\MessageVisibility;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TicketMessage extends Model
{
    use HasFactory;

    public const AUTHOR_CUSTOMER = 'customer';
    public const AUTHOR_AGENT = 'agent';
    public const AUTHOR_SYSTEM = 'system';

    /** The closed set. Story 13 writes `system`; nothing in Story 05 does. */
    public const AUTHOR_TYPES = [self::AUTHOR_CUSTOMER, self::AUTHOR_AGENT, self::AUTHOR_SYSTEM];

    protected $fillable = [
        'ticket_id', 'author_type', 'user_id', 'customer_id', 'channel', 'body', 'visibility',
    ];

    protected function casts(): array
    {
        return [
            'channel' => Channel::class,
            'visibility' => MessageVisibility::class,
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** Story 10: colleagues @mentioned in this message (internal notes only). */
    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ticket_message_mentions', 'ticket_message_id', 'mentioned_user_id')
            ->withPivot('created_at');
    }

    /**
     * THE enforcement point for the public/internal split (brief.md's
     * anti-fragmentation rule + this story's highest-consequence edge case).
     * Every customer-facing render path MUST filter through this scope — in
     * the query, never in the view layer.
     */
    public function scopePublicOnly(Builder $query): Builder
    {
        return $query->where('visibility', MessageVisibility::Public);
    }
}
