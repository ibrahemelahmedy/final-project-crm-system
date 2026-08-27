<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\CustomerAttachment;
use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Customer $customer): bool
    {
        return true;
    }

    // "Agent or above" is explicit in the story's acceptance criteria.
    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Customer $customer): bool
    {
        return true;
    }

    // Destructive and bulk actions are supervisor-only — same predicate the
    // ticket team queue uses (User::canSeeTeamQueue, User.php lines 47-50).
    public function delete(User $user, Customer $customer): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function deleteAny(User $user): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function updateAny(User $user): bool
    {
        return $user->canSeeTeamQueue();
    }

    public function addNote(User $user, Customer $customer): bool
    {
        return true;
    }

    public function addAttachment(User $user, Customer $customer): bool
    {
        return true;
    }

    public function deleteAttachment(User $user, CustomerAttachment $attachment): bool
    {
        return $user->canSeeTeamQueue() || $attachment->uploaded_by === $user->id;
    }
}
