<?php

namespace App\Models;

use Database\Factories\PortalSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 17 (WIS-16, Customer Portal). One row per signed-in portal browser.
 * Deliberately NOT Sanctum / `personal_access_tokens` — see PortalAuth and
 * docs/decisions/ADR-005-customer-portal-access.md for why a separate table
 * makes a portal token structurally incapable of authenticating a staff
 * route.
 */
class PortalSession extends Model
{
    /** @use HasFactory<PortalSessionFactory> */
    use HasFactory;

    protected $fillable = [
        'customer_id', 'token_hash', 'expires_at', 'last_used_at', 'revoked_at', 'user_agent',
    ];

    /** Never serialised — the hash has no reader outside PortalAuth's own lookup. */
    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function isLive(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    /** The one hashing site — called by both the issuing path and PortalAuth's lookup. */
    public static function hashToken(string $plaintext): string
    {
        return hash('sha256', $plaintext);
    }
}
