<?php

namespace App\Services;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Story 06 (WIS-6). Least-open-load auto-assignment with a round-robin
 * tiebreak. This takes over the `assigned_to`-null branch Story 04
 * deliberately left open in TicketController@store.
 */
class TicketAssigner
{
    private const LIVE = [TicketStatus::Open->value, TicketStatus::Pending->value];

    /**
     * Least-open-load with a round-robin tiebreak:
     *   1. active users with role Agent
     *   2. fewest tickets currently Open or Pending
     *   3. tie → whoever least recently received a ticket
     *   4. still tied (nobody ever assigned) → lowest user id
     *
     * Returns null when no active agent exists — the ticket stays Unassigned,
     * which is exactly the behaviour Story 04 shipped. Nothing crashes and
     * nothing is assigned to an inactive user.
     */
    public function pick(): ?User
    {
        return $this->candidates(UserRole::Agent)
            ->withMax('assignedTickets as last_assigned_at', 'created_at')
            ->get()
            ->sortBy([
                fn (User $a, User $b) => $a->open_load <=> $b->open_load,
                fn (User $a, User $b) => ($a->last_assigned_at ?? '') <=> ($b->last_assigned_at ?? ''),
                fn (User $a, User $b) => $a->id <=> $b->id,
            ])
            ->first();
    }

    /** The escalation target: least-loaded active user holding $role. */
    public function pickByRole(UserRole $role): ?User
    {
        return $this->candidates($role)->orderBy('open_load')->orderBy('id')->first();
    }

    /**
     * `role = Agent` only for pick(). A Team Lead is the escalation TARGET;
     * auto-assigning new work to them would defeat the escalation path.
     */
    private function candidates(UserRole $role): Builder
    {
        return User::query()
            ->where('is_active', true)
            ->where('role', $role->value)
            ->withCount(['assignedTickets as open_load' => fn ($q) => $q->whereIn('status', self::LIVE)]);
    }
}
