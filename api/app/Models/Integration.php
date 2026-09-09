<?php

namespace App\Models;

use App\Enums\IntegrationType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Story 18 (WIS-19). One row per configured integration type.
 *
 * `secret` is `encrypted` — Laravel encrypts on write and decrypts on read
 * with APP_KEY. It is in $hidden AND absent from every Resource, so two
 * independent things must both fail before it can reach a response. Never
 * return this model's toArray()/toJson() directly from a controller — always
 * go through App\Http\Resources\IntegrationResource. $hidden only covers the
 * accidental case; the Resource is the intended path.
 *
 * Rotating APP_KEY makes every stored secret undecryptable — reading `secret`
 * on a row whose ciphertext no longer decrypts throws DecryptException.
 * App\Services\HttpIntegrationTester is the only place that reads the
 * plaintext, and it catches that exception and reports an ordinary
 * connection error rather than a 500.
 */
class Integration extends Model
{
    use HasFactory;

    protected $fillable = [
        'type', 'endpoint_url', 'secret', 'secret_last_four',
        'status', 'last_checked_at', 'last_check_failed_at',
        'last_error', 'connected_by',
        // Story 25 (WIS-24).
        'inbound_enabled', 'inbound_url', 'inbound_field_map', 'conflict_rules',
        'last_inbound_sync_at', 'outbound_enabled', 'outbound_url', 'outbound_events',
        'last_outbound_sync_at',
    ];

    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return [
            'type' => IntegrationType::class,
            'secret' => 'encrypted',
            'last_checked_at' => 'datetime',
            'last_check_failed_at' => 'datetime',
            // Story 25 (WIS-24).
            'inbound_enabled' => 'boolean',
            'outbound_enabled' => 'boolean',
            'inbound_field_map' => 'array',
            'conflict_rules' => 'array',
            'outbound_events' => 'array',
            'last_inbound_sync_at' => 'datetime',
            'last_outbound_sync_at' => 'datetime',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }

    public function syncRuns(): HasMany
    {
        return $this->hasMany(SyncRun::class);
    }

    public function outboxMessages(): HasMany
    {
        return $this->hasMany(IntegrationOutboxMessage::class);
    }
}
