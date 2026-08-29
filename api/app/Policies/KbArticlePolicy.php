<?php

namespace App\Policies;

use App\Models\KbArticle;
use App\Models\User;

/**
 * Reading is universal; authoring is not (Story 09).
 *
 * The three roles come from Story 01 — no new role is introduced. "Editor"
 * means Team Lead or Administrator, expressed through the existing
 * User::canSeeTeamQueue() predicate rather than a fourth role or a second
 * in_array of the same two enum cases.
 *
 * IMPORTANT: this policy governs ACTIONS. It is NOT what hides a draft — that
 * is KbArticle::scopeVisibleTo(), enforced at the query level, so a non-editor
 * reaching a draft by direct URL gets a 404 from firstOrFail() rather than the
 * 403 this policy would produce. A 403 would confirm the slug exists.
 */
class KbArticlePolicy
{
    /** Every active authenticated user can browse the KB. */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * True for any article the caller's scoped query could return at all;
     * visibility of drafts is settled before this is ever consulted.
     */
    public function view(User $user, KbArticle $article): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function update(User $user, KbArticle $article): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function publish(User $user, KbArticle $article): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function archive(User $user, KbArticle $article): bool
    {
        return $user->canSeeTeamQueue();
    }

    /** The bulk-action bar's gate — checked against the class, not a row. */
    public function bulk(User $user): bool
    {
        return $user->canSeeTeamQueue();
    }
}
