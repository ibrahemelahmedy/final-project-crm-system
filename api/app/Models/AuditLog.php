<?php

namespace App\Models;

use App\Exceptions\AuditLogIsAppendOnly;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Str;


class AuditLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'event',
        'email',
        'ip_address',
        'user_agent',
        'context',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Append-only, enforced in the model (Story 08).
     *
     * `updating` and `deleting` fire for every path Eloquent owns — save(),
     * update(), delete(), forceDelete() — so one hook each closes the door on
     * all of them. No route exposes PUT/PATCH/DELETE on an audit row either;
     * this is the second of the two layers. On PostgreSQL a BEFORE UPDATE OR
     * DELETE trigger is the third (see the append-only migration).
     */
    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new AuditLogIsAppendOnly('update');
        });

        static::deleting(function (): void {
            throw new AuditLogIsAppendOnly('delete');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Free-text match over the retained actor email. */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where('email', 'like', '%'.$term.'%');
    }

    public static function record(string $event, ?User $user, Request $request, array $context = []): void
    {
        // Safety check: ensure password or credential fields are never captured in audit log context
        unset($context['password'], $context['password_confirmation']);

        static::create([
            'user_id' => $user?->id,
            'event' => $event,
            'email' => $user?->email ?? Str::lower((string) $request->input('email')),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'context' => !empty($context) ? $context : null,
            'created_at' => now(),
        ]);
    }
}
