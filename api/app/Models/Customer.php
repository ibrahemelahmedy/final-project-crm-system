<?php

namespace App\Models;

use App\Enums\CustomerTier;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'email', 'phone', 'company', 'tier', 'last_contact_at', 'created_by'];

    protected function casts(): array
    {
        return [
            'tier' => CustomerTier::class,
            'last_contact_at' => 'datetime',
        ];
    }

    /**
     * Stored lower-cased and trimmed. An empty string becomes null, or two
     * customers with a blank email collide on customers_email_unique.
     */
    protected function setEmailAttribute(?string $value): void
    {
        $value = $value === null ? null : Str::lower(trim($value));

        $this->attributes['email'] = $value === '' ? null : $value;
    }

    /**
     * Stores the display value as-is and derives phone_normalized (digits
     * only, keeping a leading +) in the same setter. An empty result becomes
     * null, for the same reason as setEmailAttribute above.
     */
    protected function setPhoneAttribute(?string $value): void
    {
        $value = $value === null ? null : trim($value);

        $this->attributes['phone'] = $value === '' ? null : $value;
        $this->attributes['phone_normalized'] = static::normalizePhone($value);
    }

    public static function normalizePhone(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $hasLeadingPlus = str_starts_with(trim($value), '+');
        $digits = preg_replace('/\D+/', '', $value);

        if ($digits === '' || $digits === null) {
            return null;
        }

        return $hasLeadingPlus ? '+'.$digits : $digits;
    }

    /**
     * First letter of the first and last whitespace-separated word of name,
     * upper-cased; a single-word name yields one letter. Used by
     * CustomerResource — not stored.
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

    /**
     * Open = a ticket whose status is not in ['resolved', 'closed'].
     * Story 04 replaces the literal with TicketStatus::openStates() without
     * renaming the JSON key or this scope. See contract C5.
     */
    public function scopeWithOpenTicketCount(Builder $query): Builder
    {
        if (! Schema::hasColumn('tickets', 'customer_id')) {
            return $query->selectRaw('0 as open_tickets_count');
        }

        return $query->withCount(['tickets as open_tickets_count' => fn ($q) => $q->whereNotIn('status', ['resolved', 'closed'])]);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);
        if ($term === '') {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

        return $query->where(fn (Builder $q) => $q
            ->where('name', 'like', $like)
            ->orWhere('email', 'like', $like)
            ->orWhere('company', 'like', $like)
            ->orWhere('phone_normalized', 'like', $like));
    }

    public function notes(): HasMany
    {
        return $this->hasMany(CustomerNote::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(CustomerAttachment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // No tickets() relation — tickets.customer_id does not exist yet.
    // Contract C3 assigns that relation to Story 04 (Ticket Management).
}
