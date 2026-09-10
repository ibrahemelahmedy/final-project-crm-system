<?php

namespace App\Models;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use Database\Factories\ChannelConnectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Story 26 (WIS-22), Decision 1. One row per live channel. The ABSENT row is
 * the not_connected state.
 *
 * `secret` and `verify_token` are `encrypted` — Laravel encrypts on write and
 * decrypts on read with APP_KEY. Both are in $hidden AND absent from every
 * Resource, so two independent things must both fail before either can reach
 * a response. Never return this model's toArray()/toJson() directly from a
 * controller — always go through App\Http\Resources\ChannelConnectionResource.
 *
 * Rotating APP_KEY makes every stored secret undecryptable — reading `secret`
 * or `verify_token` on a row whose ciphertext no longer decrypts throws
 * DecryptException. Only the adapters and senders read the plaintext, and
 * each catches it.
 */
class ChannelConnection extends Model
{
    /** @use HasFactory<ChannelConnectionFactory> */
    use HasFactory;

    protected $fillable = [
        'channel', 'provider', 'secret', 'secret_last_four', 'verify_token',
        'config', 'status', 'last_inbound_at', 'last_outbound_at',
        'last_error_key', 'last_error_at', 'connected_by',
    ];

    protected $hidden = ['secret', 'verify_token'];

    protected function casts(): array
    {
        return [
            'channel' => Channel::class,
            'provider' => ChannelProvider::class,
            'status' => ChannelConnectionStatus::class,
            'secret' => 'encrypted',
            'verify_token' => 'encrypted',
            'config' => 'array',
            'last_inbound_at' => 'datetime',
            'last_outbound_at' => 'datetime',
            'last_error_at' => 'datetime',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }

    public function inboundMessages(): HasMany
    {
        return $this->hasMany(ChannelInboundMessage::class);
    }

    public function outboundMessages(): HasMany
    {
        return $this->hasMany(ChannelOutboundMessage::class);
    }

    public function chatSessions(): HasMany
    {
        return $this->hasMany(ChatSession::class);
    }
}
