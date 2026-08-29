<?php

namespace App\Services\Kb;

use Illuminate\Database\Eloquent\Builder;

/**
 * ONE search contract, two engines (Story 09).
 *
 * PostgreSQL is the target and gets tsvector + ts_rank over a GIN index;
 * local development and the whole test suite run on SQLite (STATUS.md: local
 * pdo_pgsql is blocked by Windows Application Control) and get a LIKE-based
 * fallback ranked title-match-first.
 *
 * Relevance SCORES therefore differ between the two. The API contract does
 * not: both guarantee the same ordering PROPERTY — a title match outranks a
 * body-only match — which is what ArticleSearchTest asserts, so the suite
 * passes on either driver.
 *
 * The "suggested solutions" successor story reuses this interface rather than
 * writing a second ranking query.
 */
interface ArticleSearch
{
    /**
     * Constrain $query to rows matching $term and order it best-match-first.
     *
     * Composes with whatever the caller has already applied — visibleTo(),
     * a category filter, a status filter — so drafts are excluded BEFORE
     * ranking rather than filtered out of the ranked result afterwards.
     */
    public function apply(Builder $query, string $term): Builder;
}
