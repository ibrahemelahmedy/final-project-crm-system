<?php

namespace App\Models;

use App\Enums\IntegrationType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ];

    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return [
            'type' => IntegrationType::class,
            'secret' => 'encrypted',
            'last_checked_at' => 'datetime',
            'last_check_failed_at' => 'datetime',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }
}
