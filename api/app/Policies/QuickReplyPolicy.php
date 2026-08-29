<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\QuickReply;
use App\Models\User;

/**
 * Ownership decision (documented in the plan, not implicit): quick replies
 * are a SHARED TEAM LIBRARY ONLY. Every authenticated user may read; only a
 * Team Lead or Administrator may write. There is no personal/agent scope.
 */
class QuickReplyPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, QuickReply $quickReply): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $this->isWriter($user);
    }

    public function update(User $user, QuickReply $quickReply): bool
    {
        return $this->isWriter($user);
    }

    public function archive(User $user, QuickReply $quickReply): bool
    {
        return $this->isWriter($user);
    }

    private function isWriter(User $user): bool
    {
        return in_array($user->role, [UserRole::TeamLead, UserRole::Administrator], true);
    }
}
