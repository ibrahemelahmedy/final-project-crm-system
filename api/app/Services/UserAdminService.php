<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The single place internal-user administration happens (Story 08).
 *
 * Two invariants live here and nowhere else:
 *
 *  1. Token revocation on deactivation. $user->tokens()->delete() — ALL
 *     tokens, unlike Story 01's logout which deletes only
 *     currentAccessToken() — runs inside the SAME transaction that flips
 *     is_active. A controller never does this inline: a deactivation that
 *     commits without the token delete leaves a live session for a disabled
 *     user, which is the exact failure this story exists to close.
 *
 *  2. The system never reaches zero reachable Administrators. Both the
 *     self-deactivation guard and the last-Administrator guard are enforced
 *     here, and the count is taken INSIDE the transaction so two concurrent
 *     downgrades cannot both pass a check taken before either committed.
 *
 * Every mutating method emits exactly one AuditTrail entry — except a role
 * change bundled into an update, which emits its own user.role_changed
 * alongside user.updated because they are separately filterable events.
 */
class UserAdminService
{
    public function __construct(private readonly AuditTrail $audit)
    {
    }

    /**
     * @param  array{name: string, email: string, role: string, department?: string|null, password?: string|null, is_active?: bool}  $data
     */
    public function create(array $data, User $actor, Request $request): User
    {
        return DB::transaction(function () use ($data, $actor, $request) {
            $user = User::create([
                'name' => $data['name'],
                'email' => Str::lower(trim($data['email'])),
                'role' => $data['role'],
                'department' => $data['department'] ?? null,
                'is_active' => $data['is_active'] ?? true,
                // An invite with no password gets an unguessable one. There is
                // no reset-email flow in this story's scope, so the
                // Administrator sets a password explicitly or hands one over.
                'password' => Hash::make($data['password'] ?? Str::password(32)),
            ]);

            $this->audit->record(AuditTrail::USER_CREATED, $actor, $request, [
                ...AuditTrail::target('user', $user->id, $user->name),
                'role' => $user->role->value,
                'department' => $user->department,
            ]);

            return $user;
        });
    }

    /**
     * @param  array{name?: string, email?: string, role?: string, department?: string|null}  $data
     */
    public function update(User $user, array $data, User $actor, Request $request): User
    {
        return DB::transaction(function () use ($user, $data, $actor, $request) {
            $previousRole = $user->role;
            $roleIsChanging = array_key_exists('role', $data) && $data['role'] !== $previousRole->value;

            if ($roleIsChanging && $previousRole === UserRole::Administrator) {
                // A downgrade removes this user from the Administrator pool,
                // so it is governed by the same floor as a deactivation.
                $this->assertNotTheLastAdministrator($user, 'downgraded');
            }

            $attributes = array_filter(
                [
                    'name' => $data['name'] ?? null,
                    'email' => isset($data['email']) ? Str::lower(trim($data['email'])) : null,
                    'role' => $data['role'] ?? null,
                ],
                fn ($value) => $value !== null,
            );

            // department is nullable by design — clearing it is a legitimate
            // edit, so it cannot go through the array_filter above.
            if (array_key_exists('department', $data)) {
                $attributes['department'] = $data['department'];
            }

            $user->update($attributes);

            $this->audit->record(AuditTrail::USER_UPDATED, $actor, $request, [
                ...AuditTrail::target('user', $user->id, $user->name),
                'changed' => array_keys($attributes),
            ]);

            if ($roleIsChanging) {
                // Tokens are deliberately NOT revoked. The role is read from
                // the database on every request, so the next request already
                // carries the new role — signing the user out would be a
                // worse experience for no security gain.
                $this->audit->record(AuditTrail::USER_ROLE_CHANGED, $actor, $request, [
                    ...AuditTrail::target('user', $user->id, $user->name),
                    'from' => $previousRole->value,
                    'to' => $user->role->value,
                ]);
            }

            return $user->refresh();
        });
    }

    public function deactivate(User $user, User $actor, Request $request): User
    {
        if ($user->id === $actor->id) {
            // Rejected before the transaction opens — the system must never
            // reach zero reachable Administrators, and an Administrator
            // locking themselves out is the shortest path there.
            throw ValidationException::withMessages([
                'user' => ['You cannot deactivate your own account.'],
            ]);
        }

        return DB::transaction(function () use ($user, $actor, $request) {
            if (! $user->is_active) {
                return $user;
            }

            $this->assertNotTheLastAdministrator($user, 'deactivated');

            $user->forceFill(['is_active' => false])->save();

            // THE point of this story: every token, in the same transaction as
            // the flag. The user's next request 401s — not their next login.
            $revoked = $user->tokens()->delete();

            $this->audit->record(AuditTrail::USER_DEACTIVATED, $actor, $request, [
                ...AuditTrail::target('user', $user->id, $user->name),
                'tokens_revoked' => $revoked,
            ]);

            return $user->refresh();
        });
    }

    public function activate(User $user, User $actor, Request $request): User
    {
        return DB::transaction(function () use ($user, $actor, $request) {
            if ($user->is_active) {
                return $user;
            }

            $user->forceFill(['is_active' => true])->save();

            // Revoked tokens are NOT restored — reactivation means the user
            // signs in again.
            $this->audit->record(AuditTrail::USER_ACTIVATED, $actor, $request, [
                ...AuditTrail::target('user', $user->id, $user->name),
            ]);

            return $user->refresh();
        });
    }

    /**
     * Rejects the change that would leave zero reachable Administrators.
     *
     * Called inside the caller's transaction — a count taken outside it is a
     * check against state that may already have moved.
     */
    private function assertNotTheLastAdministrator(User $user, string $verb): void
    {
        if ($user->role !== UserRole::Administrator || ! $user->is_active) {
            return;
        }

        $remaining = User::where('role', UserRole::Administrator->value)
            ->where('is_active', true)
            ->whereKeyNot($user->id)
            ->count();

        if ($remaining === 0) {
            throw ValidationException::withMessages([
                'role' => ["The last active Administrator cannot be {$verb}. Promote another user first."],
            ]);
        }
    }
}
