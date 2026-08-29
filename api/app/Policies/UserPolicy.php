<?php

namespace App\Policies;

use App\Models\User;

/**
 * The centralized RBAC check for internal-user administration (Story 08).
 *
 * Administration is administrator-only, full stop — the role model is RBAC,
 * not per-record ACL, so every method here reduces to the same predicate. It
 * is still expressed as a policy rather than an inline check so that the
 * boundary has exactly one definition; Story 07's inline UserRole checks on
 * the dashboard endpoints are consolidated onto the EnsureAdministrator
 * middleware that shares this predicate.
 */
class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function view(User $user, User $target): bool
    {
        return $user->isAdministrator();
    }

    public function create(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function update(User $user, User $target): bool
    {
        return $user->isAdministrator();
    }

    /**
     * There is no delete. Deactivation only, so historical ticket and audit
     * rows stay attributed — users rows are never hard-deleted through this
     * feature. The method exists to make that explicit to anything that
     * reaches for it.
     */
    public function delete(User $user, User $target): bool
    {
        return false;
    }

    public function deactivate(User $user, User $target): bool
    {
        return $user->isAdministrator();
    }

    public function activate(User $user, User $target): bool
    {
        return $user->isAdministrator();
    }

    public function viewAuditLog(User $user): bool
    {
        return $user->isAdministrator();
    }

    public function manageSettings(User $user): bool
    {
        return $user->isAdministrator();
    }
}
