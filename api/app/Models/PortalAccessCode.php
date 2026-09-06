<?php

namespace App\Models;

use App\Services\PortalAccess;
use Database\Factories\PortalAccessCodeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 17 (WIS-16, Customer Portal). One row per OTP issue. The plaintext
 * code is NEVER stored — only `code_hash`. State is derived, never stored:
 * see CsatSurvey::getStateAttribute() for the precedent this follows.
 */
class PortalAccessCode extends Model
{
    /** @use HasFactory<PortalAccessCodeFactory> */
    use HasFactory;

    protected $fillable = [
        'customer_id', 'identifier', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'request_ip',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'attempts' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isExhausted(): bool
    {
        return $this->attempts >= PortalAccess::MAX_ATTEMPTS;
    }

    public function isUsable(): bool
    {
        return ! $this->isConsumed() && ! $this->isExpired() && ! $this->isExhausted();
    }
}
