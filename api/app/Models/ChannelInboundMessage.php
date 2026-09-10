<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\ChannelInboundMessageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Story 26 (WIS-22), Decision 5. The idempotency ledger and threading map. */
class ChannelInboundMessage extends Model
{
    /** @use HasFactory<ChannelInboundMessageFactory> */
    use HasFactory;

    protected $fillable = [
        'channel_connection_id', 'provider_message_id', 'external_thread_ref',
        'ticket_id', 'ticket_message_id', 'customer_id', 'outcome', 'received_at',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
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

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** Powers the /channels 24h inbound count — the window lives in one place. */
    public function scopeSince(Builder $query, CarbonInterface $since): Builder
    {
        return $query->where('received_at', '>=', $since);
    }
}
