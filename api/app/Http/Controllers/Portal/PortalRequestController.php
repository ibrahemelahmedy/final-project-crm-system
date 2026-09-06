<?php

namespace App\Http\Controllers\Portal;

use App\Enums\Channel;
use App\Enums\MessageVisibility;
use App\Enums\NotificationType;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\PortalRequest;
use App\Http\Requests\StorePortalReplyRequest;
use App\Http\Requests\StorePortalRequestRequest;
use App\Http\Resources\PortalMessageResource;
use App\Http\Resources\PortalTicketResource;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Services\NotificationDispatcher;
use App\Services\SlaClock;
use App\Services\TicketAssigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Story 17 (WIS-16, Customer Portal). Every action here is scoped to the
 * portal customer bound by PortalAuth (App\Http\PortalRequest). Never
 * Ticket::visibleTo() — that scope takes a User and is the staff boundary;
 * the customer boundary is `customer_id` equality and nothing else.
 */
class PortalRequestController extends Controller
{
    public function __construct(
        private SlaClock $clock,
        private TicketAssigner $assigner,
    ) {}

    /** AC3 (scope=open, default) and AC4 (scope=past) — one endpoint, two scopes. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $customer = PortalRequest::customer($request);
        $scope = $request->string('scope')->value() === 'past' ? 'past' : 'open';
        $closed = [TicketStatus::Resolved->value, TicketStatus::Closed->value];

        $tickets = Ticket::query()
            ->where('customer_id', $customer->id)
            ->when(
                $scope === 'open',
                fn ($q) => $q->whereNotIn('status', $closed)->orderByDesc('updated_at'),
                fn ($q) => $q->whereIn('status', $closed)->orderByDesc('resolved_at')->orderByDesc('updated_at')
            )
            ->withCount(['messages' => fn ($q) => $q->publicOnly()])
            ->paginate(20)
            ->withQueryString();

        return PortalTicketResource::collection($tickets);
    }

    /**
     * Resolve a ticket the caller owns, or 404 from a single code path.
     *
     * Implicit route-model binding is deliberately NOT used: a non-existent id
     * (binding failure) and another customer's id (ownership failure) must be
     * indistinguishable, down to the response body. Both land on the same
     * abort() here, so the id space is not enumerable.
     */
    private function ownedTicket(Request $request, string $ticketId): Ticket
    {
        $customer = PortalRequest::customer($request);

        $ticket = ctype_digit($ticketId)
            ? Ticket::query()->whereKey($ticketId)->where('customer_id', $customer->id)->first()
            : null;

        abort_if($ticket === null, 404);

        return $ticket;
    }

    public function show(Request $request, string $ticket): JsonResponse
    {
        $ticket = $this->ownedTicket($request, $ticket);

        $ticket->loadCount(['messages' => fn ($q) => $q->publicOnly()]);

        $messages = $ticket->messages()
            ->publicOnly()
            ->with(['author:id,name', 'customer:id,name'])
            ->orderBy('id')
            ->get();

        return response()->json([
            'ticket' => (new PortalTicketResource($ticket))->resolve(),
            'messages' => PortalMessageResource::collection($messages)->resolve(),
        ]);
    }

    public function store(StorePortalRequestRequest $request): JsonResponse
    {
        $customer = PortalRequest::customer($request);

        $ticket = DB::transaction(function () use ($request, $customer) {
            $data = $request->validated();
            $data['customer_id'] = $customer->id;
            $data['created_by'] = null;
            $data['status'] = TicketStatus::Open->value;
            $data['channel'] = Channel::WebForm->value;
            // Set explicitly (matching the tickets.priority column default)
            // rather than left absent — Ticket::create() does not re-fetch
            // the DB default into the in-memory model, and SlaClock::applyTo()
            // below needs a real Priority enum instance to key its lookup.
            $data['priority'] = Priority::Normal->value;

            $autoAssigned = false;
            $picked = $this->assigner->pick();
            if ($picked !== null) {
                $data['assigned_to'] = $picked->id;
                $autoAssigned = true;
            }

            $ticket = Ticket::create($data);

            // applyTo() runs AFTER create(), not before: the anchor is
            // created_at, which does not exist until the row is inserted.
            $this->clock->applyTo($ticket);
            $ticket->save();

            if ($autoAssigned) {
                $ticket->recordAutoAssigned($ticket->assigned_to);
            }

            if (filled($ticket->description)) {
                $ticket->messages()->create([
                    'author_type' => TicketMessage::AUTHOR_CUSTOMER,
                    'user_id' => null,
                    'customer_id' => $ticket->customer_id,
                    'channel' => $ticket->channel,
                    'body' => $ticket->description,
                ]);
            }

            return $ticket;
        });

        $ticket->loadCount(['messages' => fn ($q) => $q->publicOnly()]);

        // Portal ticket responses are returned unwrapped (no `data` envelope),
        // matching show()'s shape and the plan's Response-shapes section.
        return response()->json((new PortalTicketResource($ticket))->resolve(), 201);
    }

    public function reply(StorePortalReplyRequest $request, string $ticket, NotificationDispatcher $dispatcher): JsonResponse
    {
        $customer = PortalRequest::customer($request);
        $ticket = $this->ownedTicket($request, $ticket);

        abort_if($ticket->status === TicketStatus::Closed, 422, __('portal.closed_no_reply'));

        $message = DB::transaction(function () use ($request, $ticket, $customer) {
            $message = $ticket->messages()->create([
                'author_type' => TicketMessage::AUTHOR_CUSTOMER,
                'user_id' => null,
                'customer_id' => $customer->id,
                'channel' => $ticket->channel,
                'body' => $request->validated('body'),
                'visibility' => MessageVisibility::Public->value,
            ]);

            $ticket->touch();

            TicketEvent::create([
                'ticket_id' => $ticket->id,
                'user_id' => null,
                'event' => 'replied',
                'field' => null,
                'old_value' => null,
                'new_value' => (string) $message->id,
                'created_at' => $message->created_at,
            ]);

            if ($ticket->status === TicketStatus::Resolved) {
                $ticket->update(['status' => TicketStatus::Open->value, 'resolved_at' => null]);
                $ticket->recordReopened();
            }

            // Mirrors TicketMessageController's own last-contact rule: only a
            // message visible to the customer advances it, and only forward.
            Customer::whereKey($customer->id)
                ->where(fn ($q) => $q->whereNull('last_contact_at')
                    ->orWhere('last_contact_at', '<', $message->created_at))
                ->update(['last_contact_at' => $message->created_at]);

            return $message;
        });

        if ($ticket->assigned_to !== null) {
            $dispatcher->dispatch(
                $ticket->assignee,
                NotificationType::CustomerReplied,
                "Customer replied on ticket #{$ticket->id}",
                str($message->body)->limit(140)->value(),
                $message,
                "/tickets/{$ticket->id}"
            );
        }

        $ticket->refresh()->loadCount(['messages' => fn ($q) => $q->publicOnly()]);

        return response()->json((new PortalTicketResource($ticket))->resolve());
    }
}
