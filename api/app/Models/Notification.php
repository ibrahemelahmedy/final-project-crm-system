<?php

namespace App\Models;

use App\Enums\NotificationType;
use Database\Factories\NotificationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Story 11's first-class domain table — deliberately NOT Laravel's built-in
 * polymorphic notifications table. See App\Services\NotificationDispatcher,
 * the only write path into this table.
 */
class Notification extends Model
{
    /** @use HasFactory<NotificationFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'source_type',
        'source_id',
        'link_to',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => NotificationType::class,
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }
}
