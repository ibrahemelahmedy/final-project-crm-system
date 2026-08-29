<?php

namespace App\Services\Kb;

use Illuminate\Database\Eloquent\Builder;

/**
 * The local/SQLite fallback. No tsvector column exists on this driver — the
 * pgsql migration is a driver-guarded no-op there — so ranking is expressed
 * as an ordered CASE rather than ts_rank.
 *
 * Three tiers, mirroring pgsql's setweight('A') vs setweight('B'):
 *   0  the title matches
 *   1  only the body matches
 * A LIKE '%term%' is not a substitute for full-text search and is not
 * pretending to be one; it exists so the SAME API contract and the SAME
 * ordering property hold on the driver local development actually runs.
 */
class LikeArticleSearch implements ArticleSearch
{
    public function apply(Builder $query, string $term): Builder
    {
        // Escape the LIKE wildcards a user can type, or a query of "100%"
        // silently matches every row.
        $needle = '%'.addcslashes($term, '%_\\').'%';

        return $query
            ->where(function (Builder $q) use ($needle) {
                $q->where('title', 'like', $needle)
                    ->orWhere('body', 'like', $needle);
            })
            ->orderByRaw('CASE WHEN title LIKE ? THEN 0 ELSE 1 END', [$needle])
            ->orderByDesc('updated_at')
            ->orderBy('id');
    }
}
