<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'department',
        'branch_id',
        'department_id',
        'locale',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
        ];
    }

    /** Free-text match over name and email — the Users list search box. */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', '%'.$term.'%')
                ->orWhere('email', 'like', '%'.$term.'%');
        });
    }

    public function isAdministrator(): bool
    {
        return $this->role === UserRole::Administrator;
    }

    public function canSeeTeamQueue(): bool
    {
        return in_array($this->role, [UserRole::TeamLead, UserRole::Administrator], true);
    }

    /**
     * First letter of the first and last whitespace-separated word of name,
     * upper-cased; a single-word name yields one letter. Used by
     * TicketResource's assignee shape — not stored.
     */
    public function initials(): string
    {
        $words = Str::of($this->name)->squish()->explode(' ')->filter()->values();

        if ($words->isEmpty()) {
            return '';
        }

        $first = Str::upper(Str::substr($words->first(), 0, 1));

        if ($words->count() === 1) {
            return $first;
        }

        $last = Str::upper(Str::substr($words->last(), 0, 1));

        return $first.$last;
    }

    /** Story 06: what TicketAssigner counts open load against. */
    public function assignedTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assigned_to');
    }

    /**
     * Story 20 (WIS-20). Named `departmentRef`, not `department` — that
     * name is already taken by the free-text attribute above ($fillable),
     * and a relation of the same name would be silently shadowed on
     * property access ($user->department would keep returning the string).
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function departmentRef(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'department_id');
    }
}
