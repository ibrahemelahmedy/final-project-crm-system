<?php

namespace App\Models;

use App\Enums\ChannelDeliveryStatus;
use Database\Factories\ChannelOutboundMessageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/** Story 26 (WIS-22), Decision 8. The outbox — mirrors IntegrationOutboxMessage. */
class ChannelOutboundMessage extends Model
{
    /** @use HasFactory<ChannelOutboundMessageFactory> */
    use HasFactory;

    protected $fillable = [
        'channel_connection_id', 'ticket_id', 'ticket_message_id',
        'recipient', 'body', 'provider_message_id', 'in_reply_to',
        'status', 'attempts', 'next_attempt_at', 'last_status',
        'last_error_key', 'delivered_at', 'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ChannelDeliveryStatus::class,
            'attempts' => 'integer',
            'next_attempt_at' => 'datetime',
            'delivered_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(ChannelConnection::class, 'channel_connection_id');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function ticketMessage(): BelongsTo
    {
        return $this->belongsTo(TicketMessage::class);
    }

    public function scopeDue(Builder $q, ?Carbon $now = null): Builder
    {
        $now ??= Carbon::now();

        return $q->where('status', ChannelDeliveryStatus::Pending->value)
            ->where(fn ($w) => $w->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', $now))
            ->orderBy('id');
    }
}
