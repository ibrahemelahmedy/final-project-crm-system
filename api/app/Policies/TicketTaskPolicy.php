<?php

namespace App\Policies;

use App\Models\TicketTask;
use App\Models\User;

class TicketTaskPolicy
{
    /** Anyone who can view the parent ticket can view its tasks (checked at the ticket in the controller). */
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, TicketTask $task): bool
    {
        return $this->canManage($user, $task);
    }

    public function update(User $user, TicketTask $task): bool
    {
        return $this->canManage($user, $task);
    }

    public function complete(User $user, TicketTask $task): bool
    {
        return $this->canManage($user, $task);
    }

    private function canManage(User $user, TicketTask $task): bool
    {
        return $user->canSeeTeamQueue()
            || $task->assignee_id === $user->id
            || $task->created_by === $user->id;
    }
}
