<?php

namespace App\Policies;

use App\Models\Ticket;
use App\Models\User;

class TicketPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Ticket $ticket): bool
    {
        return $user->canSeeTeamQueue() || $ticket->assigned_to === $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Ticket $ticket): bool
    {
        return $this->view($user, $ticket);
    }

    /** Reassigning a ticket away from yourself is a supervisory act. */
    public function assign(User $user, Ticket $ticket): bool
    {
        return $user->canSeeTeamQueue() || $ticket->assigned_to === $user->id;
    }
}
