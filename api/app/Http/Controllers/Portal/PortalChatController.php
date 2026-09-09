<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\PortalRequest;
use App\Http\Requests\StorePortalChatMessageRequest;
use App\Http\Resources\PortalChatConversationResource;
use App\Http\Resources\PortalChatMessageResource;
use App\Http\Resources\PortalTicketResource;
use App\Services\Ai\PortalChatbot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Story 24 (WIS-23), Task 16. Every action resolves identity through
 * PortalRequest, never $request->user(). Answers 200 with a `state` (Decision
 * 10), except the framework's 429 from throttle:portal-chat.
 */
class PortalChatController extends Controller
{
    public function __construct(private PortalChatbot $bot) {}

    /** GET /api/portal/chat — the live conversation and its messages, or an empty shell. */
    public function show(Request $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $conversation = $this->bot->existing($session);

        return response()->json([
            'enabled' => (bool) (config('ai.enabled') && config('ai.chat.enabled')),
            'conversation' => $conversation
                ? (new PortalChatConversationResource($conversation))->resolve() : null,
            'messages' => $conversation
                ? PortalChatMessageResource::collection($conversation->messages)->resolve() : [],
        ]);
    }

    /** POST /api/portal/chat/messages */
    public function store(StorePortalChatMessageRequest $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $conversation = $this->bot->conversationFor($session, app()->getLocale());

        ['state' => $state, 'message' => $message] =
            $this->bot->ask($conversation, $request->validated('body'));

        return response()->json([
            'state' => $state->value,
            'conversation' => (new PortalChatConversationResource($conversation->refresh()))->resolve(),
            'message' => $message ? (new PortalChatMessageResource($message))->resolve() : null,
        ]);
    }

    /** POST /api/portal/chat/escalate */
    public function escalate(Request $request): JsonResponse
    {
        $session = PortalRequest::session($request);
        $customer = PortalRequest::customer($request);
        $conversation = $this->bot->existing($session);

        abort_if($conversation === null || $conversation->message_count === 0, 422,
            __('ai.chat_escalation_empty'));

        $ticket = $this->bot->escalate($conversation, $customer);
        $ticket->loadCount(['messages' => fn ($q) => $q->publicOnly()]);

        return response()->json([
            'conversation' => (new PortalChatConversationResource($conversation->refresh()))->resolve(),
            'ticket' => (new PortalTicketResource($ticket))->resolve(),
        ], 201);
    }
}
