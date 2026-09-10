<?php

namespace App\Policies;

use App\Models\ChannelConnection;
use App\Models\User;

/**
 * Story 26 (WIS-22). Copies IntegrationPolicy: administrator-only for every
 * ability. Redundant with the `administrator` middleware on the whole
 * /api/admin/* group ON PURPOSE — the route gate protects the URL, this
 * protects the action if it is ever called from elsewhere. Auto-discovered
 * by Laravel's Model -> Policy naming convention; no explicit
 * Gate::policy() registration needed (see AppServiceProvider).
 */
class ChannelConnectionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, ?ChannelConnection $connection = null): bool
    {
        return $user->isAdministrator();
    }

    public function delete(User $user, ?ChannelConnection $connection = null): bool
    {
        return $user->isAdministrator();
    }
}
