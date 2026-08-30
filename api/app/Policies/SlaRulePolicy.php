<?php

namespace App\Policies;

use App\Models\SlaRule;
use App\Models\User;

/**
 * Story 06. A NEW policy class — SLA abilities are deliberately not added to
 * TicketPolicy, which is Story 04's and which TicketScopeTest depends on.
 *
 * Every ability is Administrator-only. An Agent and a Team Lead both receive
 * 403 on every /api/sla-rules route.
 */
class SlaRulePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function view(User $user, SlaRule $slaRule): bool
    {
        return $user->isAdministrator();
    }

    public function create(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, SlaRule $slaRule): bool
    {
        return $user->isAdministrator();
    }

    public function delete(User $user, SlaRule $slaRule): bool
    {
        return $user->isAdministrator();
    }
}
