<?php

namespace App\Http\Controllers;

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\TaskStatus;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Http\Requests\BulkTicketActionRequest;
use App\Http\Requests\StoreTicketRequest;
use App\Http\Requests\UpdateTicketRequest;
use App\Http\Resources\TicketEventResource;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TicketController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Ticket::class);

        $perPage = (int) $request->integer('per_page', 25);
        $perPage = in_array($perPage, [10, 25, 50], true) ? $perPage : 25;

        $filters = [
            'status' => $request->array('status'),
            'priority' => $request->array('priority'),
            'channel' => $request->array('channel'),
            'category' => $request->array('category'),
            'customer_id' => $request->array('customer_id'),
            'assigned_to' => $request->array('assigned_to'),
            'q' => $request->string('q')->trim()->value() ?: null,
        ];

        $tickets = Ticket::query()
            ->visibleTo($request->user())          // FIRST — the security boundary
            ->filter($filters)                     // then the user's own facets
            ->with(['assignee:id,name', 'customer:id,name'])
            ->sorted($request->string('sort')->value())
            ->paginate($perPage)
            ->withQueryString();

        return TicketResource::collection($tickets);
    }

    public function store(StoreTicketRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['created_by'] = $request->user()->id;
        $data['status'] = TicketStatus::Open->value;

        // The intake is explicit: a new ticket is NEVER silently assigned to
        // its creator. Auto-assignment is Story 06's rule; until it lands,
        // an unnamed assignee means Unassigned.
        if (! empty($data['assigned_to'])) {
            $target = Ticket::make($data);
            $target->assigned_to = $data['assigned_to'];
            if (! $request->user()->can('assign', $target)) {
                unset($data['assigned_to']);
            }
        }

        $ticket = Ticket::create($data);

        // Story 05: the customer's original request IS the first message in the thread.
        if (filled($ticket->description)) {
            $ticket->messages()->create([
                'author_type' => \App\Models\TicketMessage::AUTHOR_CUSTOMER,
                'user_id' => null,
                'customer_id' => $ticket->customer_id,
                'channel' => $ticket->channel,
                'body' => $ticket->description,
            ]);
        }

        return (new TicketResource($ticket->load(['assignee:id,name', 'customer:id,name'])))
            ->response()->setStatusCode(201);
    }

    public function show(Request $request, Ticket $ticket): TicketResource
    {
        $this->authorize('view', $ticket);

        return new TicketResource($ticket->load(['assignee:id,name', 'customer:id,name', 'creator:id,name']));
    }

    public function update(UpdateTicketRequest $request, Ticket $ticket): TicketResource
    {
        $this->authorize('update', $ticket);
        $data = $request->validated();

        $wasFinished = null;
        $next = null;

        if (array_key_exists('status', $data)) {
            $next = TicketStatus::from($data['status']);
            if (! $ticket->status->canTransitionTo($next)) {
                throw ValidationException::withMessages([
                    'status' => "Cannot move a {$ticket->status->label()} ticket to {$next->label()}.",
                ]);
            }
            $wasFinished = in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true);

            $data['resolved_at'] = $next === TicketStatus::Resolved ? now() : null;
            $data['closed_at'] = $next === TicketStatus::Closed ? now() : null;
        }

        if (array_key_exists('assigned_to', $data)) {
            $this->authorize('assign', $ticket);
        }

        $cancelledTaskCount = DB::transaction(function () use ($ticket, $data, $next) {
            $ticket->update($data);

            // Story 10: "warn, then auto-cancel." Closing a ticket cancels
            // its open tasks — no reminder can ever fire for a closed ticket.
            return $next === TicketStatus::Closed ? $this->cancelOpenTasks($ticket) : 0;
        });

        if ($wasFinished && $next === TicketStatus::Open) {
            $ticket->recordReopened();
        }

        return (new TicketResource($ticket->load(['assignee:id,name', 'customer:id,name'])))
            ->additional(['cancelled_tasks_count' => $cancelledTaskCount]);
    }

    /** Story 10's ticket-close hook. Returns the count so the UI can confirm what was cancelled. */
    private function cancelOpenTasks(Ticket $ticket): int
    {
        return $ticket->tasks()
            ->where('status', TaskStatus::Open->value)
            ->update([
                'status' => TaskStatus::Cancelled->value,
                'cancel_reason' => 'ticket_closed',
            ]);
    }

    public function bulk(BulkTicketActionRequest $request): JsonResponse
    {
        $applied = [];
        $skipped = [];

        DB::transaction(function () use ($request, &$applied, &$skipped) {
            $tickets = Ticket::query()
                ->visibleTo($request->user())              // rows outside the actor's scope never load
                ->whereIn('id', $request->validated('ids'))
                ->lockForUpdate()
                ->get();

            $action = $request->validated('action');

            foreach ($tickets as $ticket) {
                $ability = $action === 'assign' ? 'assign' : 'update';

                if ($request->user()->cannot($ability, $ticket)) {
                    $skipped[] = ['id' => $ticket->id, 'reason' => 'forbidden'];
                    continue;
                }

                if ($action === 'assign') {
                    $ticket->update(['assigned_to' => $request->validated('assigned_to')]);
                } else {
                    $next = TicketStatus::from($request->validated('status'));

                    if (! $ticket->status->canTransitionTo($next)) {
                        $skipped[] = ['id' => $ticket->id, 'reason' => 'invalid_transition'];
                        continue;
                    }

                    $wasFinished = in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true);

                    $ticket->update([
                        'status' => $next->value,
                        'resolved_at' => $next === TicketStatus::Resolved ? now() : null,
                        'closed_at' => $next === TicketStatus::Closed ? now() : null,
                    ]);

                    if ($next === TicketStatus::Closed) {
                        $this->cancelOpenTasks($ticket);
                    }

                    if ($wasFinished && $next === TicketStatus::Open) {
                        $ticket->recordReopened();
                    }
                }

                $applied[] = $ticket->id;
            }
        });

        return response()->json([
            'applied' => $applied,
            'skipped' => $skipped,
        ], 200);
    }

    public function events(Request $request, Ticket $ticket): AnonymousResourceCollection
    {
        $this->authorize('view', $ticket);

        return TicketEventResource::collection($ticket->events()->with('actor:id,name')->get());
    }

    public function meta(Request $request): JsonResponse
    {
        return response()->json([
            'priorities' => Priority::options(),
            'statuses' => TicketStatus::options(),
            'channels' => Channel::options(),
            'categories' => array_map(
                fn (string $c) => ['value' => $c, 'label' => Ticket::categoryLabel($c)],
                Ticket::CATEGORIES
            ),
            'transitions' => collect(TicketStatus::cases())
                ->mapWithKeys(fn (TicketStatus $s) => [
                    $s->value => array_map(fn (TicketStatus $t) => $t->value, $s->allowedTransitions()),
                ])
                ->all(),
            'agents' => User::query()
                ->where('is_active', true)
                ->whereIn('role', [UserRole::Agent, UserRole::TeamLead])
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn ($u) => ['value' => (string) $u->id, 'label' => $u->name])
                ->all(),
        ]);
    }
}
