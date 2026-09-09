<?php

namespace App\Services\Ai;

use App\Enums\ArticleStatus;
use App\Models\KbArticle;
use App\Services\Kb\ArticleSearch;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Story 24 (WIS-23), Decision 7. The ONLY source of chatbot ground truth:
 * PUBLISHED KB articles. Reuses the ArticleSearch contract (Story 09) and the
 * exact published-only pair PortalFaqController::index():25-27 uses.
 *
 * KbArticle::scopeVisibleTo() is deliberately NOT used — it takes a ?User and
 * is the STAFF boundary. A portal caller has no User.
 */
final class KbGrounding
{
    public function __construct(private ArticleSearch $search) {}

    /** @return Collection<int, KbArticle> */
    public function forQuestion(string $question): Collection
    {
        $term = trim($question);

        if ($term === '') {
            return collect();
        }

        $query = KbArticle::query()
            ->where('status', ArticleStatus::Published->value)
            ->whereNotNull('published_at');

        return $this->search->apply($query, $term)
            ->limit((int) config('ai.chat.grounding_articles'))
            ->get();
    }

    /** The CONTEXT block. Empty collection => empty string; the caller short-circuits. */
    public function render(Collection $articles): string
    {
        return $articles->map(fn (KbArticle $a) => sprintf(
            "[[article: %s]] %s\n%s",
            $a->slug,
            $a->title,
            Str::limit(strip_tags((string) ($a->body ?? $a->excerpt ?? '')),
                (int) config('ai.chat.grounding_chars'))
        ))->implode("\n\n");
    }

    /**
     * @param  Collection<int, KbArticle>  $offered
     * @param  array<int, string>  $slugs
     * @return array<int, array{id: int, slug: string, title: string}>
     */
    public function citations(Collection $offered, array $slugs): array
    {
        // NEVER trust the model's slugs — intersect with what was offered.
        return $offered
            ->filter(fn (KbArticle $a) => in_array($a->slug, $slugs, true))
            ->map(fn (KbArticle $a) => ['id' => $a->id, 'slug' => $a->slug, 'title' => $a->title])
            ->values()->all();
    }
}
