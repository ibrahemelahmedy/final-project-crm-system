<?php

namespace App\Models;

use App\Enums\ArticleStatus;
use Database\Factories\KbArticleFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class KbArticle extends Model
{
    /** @use HasFactory<KbArticleFactory> */
    use HasFactory;

    protected $fillable = [
        'title', 'slug', 'body', 'body_html', 'excerpt',
        'kb_category_id', 'status', 'author_id', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ArticleStatus::class,
            'published_at' => 'datetime',
            'view_count' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(KbCategory::class, 'kb_category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(KbArticleVersion::class)->latest('created_at');
    }

    /**
     * THE visibility boundary, enforced at the QUERY level and not by hiding
     * fields in a response.
     *
     * A non-editor's query can never return a draft, so a draft reached by
     * direct URL produces a 404 from firstOrFail() — never a 403, which would
     * confirm that the slug exists.
     */
    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        if ($user && $user->canSeeTeamQueue()) {
            return $query;
        }

        return $query->where('status', ArticleStatus::Published->value);
    }

    /** Free-text fallback used by the index when no ranking is requested. */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term) {
            $q->where('title', 'like', '%'.$term.'%')
                ->orWhere('body', 'like', '%'.$term.'%');
        });
    }

    public function isPublished(): bool
    {
        return $this->status === ArticleStatus::Published;
    }

    /**
     * A unique slug for a NEW article. Collisions append a numeric suffix.
     *
     * DECISION (the regenerated plan's call on "a slug collision on rename"):
     * the slug is derived once, at creation, and is FROZEN thereafter. A title
     * rename never repoints it, so an existing published slug can never be
     * silently reused for different content and no redirect table is needed.
     * The reader's breadcrumb and heading show the current title regardless.
     */
    public static function freshSlug(string $title): string
    {
        $base = Str::slug($title);

        if ($base === '') {
            $base = 'article';
        }

        $slug = $base;
        $n = 2;

        while (static::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$n;
            $n++;
        }

        return $slug;
    }
}
