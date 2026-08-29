<?php

namespace App\Services\Kb;

use Illuminate\Database\Eloquent\Builder;

/**
 * The target engine: the `search_vector` column, its GIN index, and the
 * BEFORE INSERT OR UPDATE trigger keeping it current, all created by
 * 2026_08_28_100300_add_search_vector_to_kb_articles.php (pgsql only).
 *
 * The trigger builds the vector as
 *   setweight(to_tsvector(title), 'A') || setweight(to_tsvector(body), 'B')
 * so ts_rank scores a title match above a body-only match without this class
 * doing any ordering arithmetic of its own.
 */
class PostgresArticleSearch implements ArticleSearch
{
    public function apply(Builder $query, string $term): Builder
    {
        return $query
            ->whereRaw('search_vector @@ plainto_tsquery(?, ?)', ['english', $term])
            ->orderByRaw('ts_rank(search_vector, plainto_tsquery(?, ?)) DESC', ['english', $term])
            // A secondary key keeps paging stable when two rows rank equally.
            ->orderByDesc('updated_at')
            ->orderBy('id');
    }
}
