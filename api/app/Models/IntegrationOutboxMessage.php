<?php

namespace App\Models;

use App\Enums\IntegrationEvent;
use App\Enums\OutboxStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Story 25 (WIS-24). One row per outbound event, durable across the
 * process — this IS the delivery guarantee (Decision 2).
 */
class IntegrationOutboxMessage extends Model
{
    use HasFactory;

    /** Eloquent would otherwise look for `integration_outbox_messages`. */
    protected $table = 'integration_outbox';

    protected $fillable = [
        'integration_id', 'event', 'event_id', 'payload',
        'status', 'attempts', 'next_attempt_at',
        'last_status', 'last_error_key', 'delivered_at', 'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'event' => IntegrationEvent::class,
            'status' => OutboxStatus::class,
            'payload' => 'array',
            'attempts' => 'integer',
            'next_attempt_at' => 'datetime',
            'delivered_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }

    /** Pending and due. `next_attempt_at IS NULL` means "never attempted, due now". */
    public function scopeDue(Builder $q, ?Carbon $now = null): Builder
    {
        $now ??= Carbon::now();

        return $q->where('status', OutboxStatus::Pending->value)
            ->where(fn ($w) => $w->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', $now))
            ->orderBy('id');
    }

    public function scopeDead(Builder $q): Builder
    {
        return $q->where('status', OutboxStatus::Dead->value);
    }
}
