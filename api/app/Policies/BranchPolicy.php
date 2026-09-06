<?php

namespace App\Policies;

use App\Models\Branch;
use App\Models\User;

/**
 * Story 20 (WIS-20). Every ability is Administrator-only, mirroring
 * IntegrationPolicy. Redundant with the `administrator` middleware on the
 * whole /api/admin/* group ON PURPOSE: the route gate protects the URL,
 * this protects the action if it is ever called from elsewhere.
 */
class BranchPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function create(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, ?Branch $branch = null): bool
    {
        return $user->isAdministrator();
    }
}
