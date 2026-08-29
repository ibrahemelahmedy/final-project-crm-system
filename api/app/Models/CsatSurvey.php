<?php

namespace App\Models;

use App\Enums\CsatSurveyState;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 13 (CSAT Collection) — one row per ticket resolution cycle.
 *
 * `uuid` is the ONLY public identifier; `id` is never exposed. Route-model
 * binding resolves on `uuid` (see getRouteKeyName). The `state` accessor is
 * the single source of truth for which artboard renders.
 */
class CsatSurvey extends Model
{
    use HasFactory;
    use HasUuids;

    protected $fillable = [
        'uuid', 'ticket_id', 'resolution_cycle', 'resolved_by',
        'resolved_at', 'rating', 'comment', 'responded_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'responded_at' => 'datetime',
            'expires_at' => 'datetime',
            'rating' => 'integer',
        ];
    }

    /** Only `uuid` is auto-generated; the composite key stays manual. */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * An answered survey stays answered forever — the recorded response is
     * shown read-only even past `expires_at`. Only an unanswered survey can
     * expire.
     */
    public function getStateAttribute(): CsatSurveyState
    {
        if ($this->responded_at !== null) {
            return CsatSurveyState::Answered;
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return CsatSurveyState::Expired;
        }

        return CsatSurveyState::Outstanding;
    }

    /** An outstanding survey blocks a new one for the same cycle. */
    public function isOutstanding(): bool
    {
        return $this->state === CsatSurveyState::Outstanding;
    }
}
