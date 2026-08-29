<?php

namespace App\Http\Controllers;

use App\Enums\MessageVisibility;
use App\Enums\NotificationType;
use App\Http\Requests\StoreTicketMessageRequest;
use App\Http\Resources\TicketMessageResource;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Services\MentionResolver;
use App\Services\NotificationDispatcher;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class TicketMessageController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request, Ticket $ticket): AnonymousResourceCollection
    {
        $this->authorize('view', $ticket);

        // Every caller here is an authenticated, `TicketPolicy::view`-gated
        // agent/lead/admin — internal notes are meant for exactly this
        // audience, so this index is deliberately NOT publicOnly()-scoped.
        // A customer-facing surface must go through TicketMessage::publicOnly()
        // instead (see InternalNoteVisibilityTest) — never through this route.
        $messages = $ticket->messages()
            ->reorder('id', 'desc')                       // newest first — the cursor's order
            ->with(['author:id,name', 'customer:id,name', 'mentions:id,name'])
            ->cursorPaginate(30)
            ->withQueryString();

        return TicketMessageResource::collection($messages);
    }

    public function store(
        StoreTicketMessageRequest $request,
        Ticket $ticket,
        MentionResolver $mentionResolver,
        NotificationDispatcher $dispatcher,
    ): JsonResponse {
        $visibility = MessageVisibility::from($request->validated('visibility', MessageVisibility::Public->value));
        $mentionIds = $request->validated('mentions', []);

        // Mention resolution runs BEFORE the message insert, in the same
        // transaction — a rejected mention must never leave a partial
        // message row (plan's "Mention of an unauthorized user" edge case).
        $mentionedUsers = $mentionResolver->resolve($mentionIds, $ticket);

        $message = DB::transaction(function () use ($request, $ticket, $visibility, $mentionedUsers) {
            $message = $ticket->messages()->create([
                'author_type' => TicketMessage::AUTHOR_AGENT,
                'user_id' => $request->user()->id,
                'customer_id' => null,
                'channel' => $ticket->channel,        // never client-supplied
                'body' => $request->validated('body'),
                'visibility' => $visibility->value,
            ]);

            $ticket->touch();                             // AC: last activity is bumped

            TicketEvent::create([
                'ticket_id' => $ticket->id,
                'user_id' => $request->user()->id,
                'event' => $visibility === MessageVisibility::Internal ? 'internal_note_added' : 'replied',
                'field' => null,
                'old_value' => null,
                'new_value' => (string) $message->id,
                'created_at' => $message->created_at,
            ]);

            if ($mentionedUsers->isNotEmpty()) {
                $message->mentions()->attach(
                    $mentionedUsers->mapWithKeys(fn ($u) => [$u->id => ['created_at' => $message->created_at]])->all()
                );

                foreach ($mentionedUsers as $mentioned) {
                    TicketEvent::create([
                        'ticket_id' => $ticket->id,
                        'user_id' => $request->user()->id,
                        'event' => 'mentioned',
                        'field' => null,
                        'old_value' => null,
                        'new_value' => (string) $mentioned->id,
                        'created_at' => $message->created_at,
                    ]);
                }
            }

            // A customer's own contact timestamp only advances on a message
            // visible to them — an internal note is not customer contact.
            if ($visibility === MessageVisibility::Public) {
                Customer::whereKey($ticket->customer_id)
                    ->where(fn ($q) => $q->whereNull('last_contact_at')
                        ->orWhere('last_contact_at', '<', $message->created_at))
                    ->update(['last_contact_at' => $message->created_at]);
            }

            return $message;
        });

        // Dispatched after commit — a mention notification for a message
        // that failed to persist would be a false alert.
        foreach ($mentionedUsers as $mentioned) {
            $dispatcher->dispatch(
                $mentioned,
                NotificationType::Mention,
                "You were mentioned on ticket #{$ticket->id}",
                str($message->body)->limit(140)->value(),
                $message,
                "/tickets/{$ticket->id}"
            );
        }

        return (new TicketMessageResource($message->load(['author:id,name', 'mentions:id,name'])))
            ->response()->setStatusCode(201);
    }
}
