<?php

namespace App\Models;

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ticket extends Model
{
    use HasFactory;

    public const CATEGORIES = ['general', 'billing', 'technical', 'account', 'feature_request'];

    protected $fillable = [
        'subject', 'description', 'customer_id', 'status', 'priority',
        'category', 'channel', 'assigned_to', 'created_by',
        'resolved_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => TicketStatus::class,
            'priority' => Priority::class,
            'channel' => Channel::class,
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public static function categoryLabel(string $category): string
    {
        return match ($category) {
            'billing' => 'Billing',
            'technical' => 'Technical',
            'account' => 'Account',
            'feature_request' => 'Feature request',
            default => 'General',
        };
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(TicketEvent::class)->latest('created_at');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)->orderBy('id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(TicketTask::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        // Shortcut: team queue expands to all tickets until teams table lands in Story 08 (users-roles-admin)
        return $user->canSeeTeamQueue()
            ? $query
            : $query->where('assigned_to', $user->id);
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
            ->when($filters['priority'] ?? null, fn ($q, $v) => $q->whereIn('priority', $v))
            ->when($filters['channel'] ?? null, fn ($q, $v) => $q->whereIn('channel', $v))
            ->when($filters['category'] ?? null, fn ($q, $v) => $q->whereIn('category', $v))
            ->when($filters['customer_id'] ?? null, fn ($q, $v) => $q->whereIn('customer_id', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where('subject', 'like', '%'.$v.'%'))
            ->when($filters['assigned_to'] ?? null, function ($q, $v) {
                $unassigned = in_array('unassigned', $v, true);
                $ids = array_values(array_filter($v, fn ($x) => $x !== 'unassigned'));

                return $q->where(function ($inner) use ($unassigned, $ids) {
                    if ($ids) {
                        $inner->whereIn('assigned_to', $ids);
                    }
                    if ($unassigned) {
                        $inner->orWhereNull('assigned_to');
                    }
                });
            });
    }

    public function scopeSorted(Builder $query, ?string $sort): Builder
    {
        $direction = str_starts_with((string) $sort, '-') ? 'desc' : 'asc';
        $column = ltrim((string) $sort, '-');

        return match ($column) {
            'id' => $query->orderBy('tickets.id', $direction),
            'priority' => $query->orderBy(Priority::sortExpression(), $direction),
            'status' => $query->orderBy('tickets.status', $direction),
            'updated_at' => $query->orderBy('tickets.updated_at', $direction),
            'customer' => $query->orderBy(
                Customer::select('name')->whereColumn('customers.id', 'tickets.customer_id'),
                $direction
            ),
            default => $query->latest('tickets.created_at'),
        };
    }

    protected static function booted(): void
    {
        static::created(fn (Ticket $t) => $t->recordEvent('created'));

        static::updated(function (Ticket $t) {
            foreach (['status', 'priority', 'category'] as $field) {
                if ($t->wasChanged($field)) {
                    $t->recordEvent(
                        $field.'_changed',
                        $field,
                        (string) ($t->getOriginal($field) instanceof \BackedEnum
                            ? $t->getOriginal($field)->value
                            : $t->getOriginal($field)),
                        (string) ($t->{$field} instanceof \BackedEnum ? $t->{$field}->value : $t->{$field})
                    );
                }
            }

            if ($t->wasChanged('assigned_to')) {
                $t->recordEvent(
                    $t->assigned_to === null ? 'unassigned' : 'assigned',
                    'assigned_to',
                    (string) $t->getOriginal('assigned_to'),
                    (string) $t->assigned_to
                );
            }
        });
    }

    /** The one event wasChanged() cannot infer — recorded explicitly by the controller. */
    public function recordReopened(): void
    {
        $this->recordEvent('reopened');
    }

    protected function recordEvent(string $event, ?string $field = null, ?string $old = null, ?string $new = null): void
    {
        TicketEvent::create([
            'ticket_id' => $this->id,
            'user_id' => auth()->id(),
            'event' => $event,
            'field' => $field,
            'old_value' => $old,
            'new_value' => $new,
            'created_at' => now(),
        ]);
    }
}
