<?php

namespace App\Policies;

use App\Models\CsatSurvey;
use App\Models\User;

/**
 * Story 13. The agent-facing read of a ticket's survey delegates entirely to
 * TicketPolicy@view — an agent who cannot see the ticket cannot see its CSAT.
 *
 * There is deliberately NO `update` and NO `delete` ability, for any role.
 * The criterion is explicit: an agent can read their own average but has no
 * route, policy ability, or UI control to edit or delete a response. The
 * public response endpoint is signed-link gated, not policy gated.
 */
class CsatSurveyPolicy
{
    public function view(User $user, CsatSurvey $survey): bool
    {
        return $user->can('view', $survey->ticket);
    }
}
