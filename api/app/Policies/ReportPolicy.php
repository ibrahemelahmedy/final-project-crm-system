<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\User;

/**
 * Story 12 (WIS-7) — the management Reports dashboard.
 *
 * Reports is denied to the Agent role server-side; this is the one gate. The
 * hidden nav entry and the SPA route guard are UX affordances, not access
 * control. Registered as the `view-reports` gate in AppServiceProvider,
 * beside the auto-discovered {@see TicketPolicy}.
 */
class ReportPolicy
{
    public function view(User $user): bool
    {
        return in_array($user->role, [UserRole::TeamLead, UserRole::Administrator], true);
    }
}
