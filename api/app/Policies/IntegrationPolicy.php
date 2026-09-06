<?php

namespace App\Policies;

use App\Models\Integration;
use App\Models\User;

/**
 * Story 18 (WIS-19). Every ability is Administrator-only, mirroring
 * SlaRulePolicy. Redundant with the `administrator` middleware on the whole
 * /api/admin/* group ON PURPOSE: the route gate protects the URL, this
 * protects the action if it is ever called from elsewhere.
 */
class IntegrationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, ?Integration $integration = null): bool
    {
        return $user->isAdministrator();
    }

    public function delete(User $user, ?Integration $integration = null): bool
    {
        return $user->isAdministrator();
    }
}
