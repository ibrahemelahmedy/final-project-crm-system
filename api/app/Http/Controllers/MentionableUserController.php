<?php

namespace App\Http\Controllers;

use App\Http\Resources\TaskUserResource;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * `GET /api/tickets/{ticket}/mentionable-users` — colleagues who pass
 * `TicketPolicy::view` for THIS ticket, active only. Excluding a deactivated
 * user here is defense #1 of the two the plan requires (MentionResolver's
 * 422 on submit is defense #2).
 */
class MentionableUserController extends Controller
{
    use AuthorizesRequests;

    public function index(Ticket $ticket): AnonymousResourceCollection
    {
        $this->authorize('view', $ticket);

        // Team leads and administrators can see every team-visible ticket
        // (TicketPolicy::view), so any active colleague qualifies; an agent's
        // own view is scoped to their assigned tickets, so the assignee and
        // whoever can see the team queue are the only ones who pass.
        $mentionable = User::query()
            ->where('is_active', true)
            ->where(function ($q) use ($ticket) {
                $q->whereIn('role', ['team_lead', 'administrator'])
                    ->orWhere('id', $ticket->assigned_to);
            })
            ->where('id', '!=', request()->user()->id)
            ->orderBy('name')
            ->get();

        return TaskUserResource::collection($mentionable);
    }
}
