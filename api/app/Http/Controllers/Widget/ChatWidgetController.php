<?php

namespace App\Http\Controllers\Widget;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Http\ChatWidgetRequest;
use App\Http\Controllers\Controller;
use App\Models\ChannelConnection;
use App\Models\ChatSession;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Services\Channels\InboundCustomerResolver;
use App\Services\Channels\InboundMessage;
use App\Services\Channels\IngestedTicketFactory;
use App\Services\Channels\MessageIngestor;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Story 26 (WIS-22), Decision 10 & 11. The unauthenticated bootstrap
 * (`start`) plus the session-gated body (`messages`, `send`, `identify`).
 * Every response is 200 with a `state` field — a 503 in an iframe is a dead
 * end (WIS-23's Decision 10 precedent, ApiContractTest.php:382-405).
 */
class ChatWidgetController extends Controller
{
    public function __construct(
        private readonly InboundCustomerResolver $customers,
        private readonly IngestedTicketFactory $factory,
        private readonly MessageIngestor $ingestor,
    ) {}

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate(['site_key' => ['required', 'string']]);

        $connection = ChannelConnection::query()
            ->where('channel', Channel::Chat->value)
            ->where('status', ChannelConnectionStatus::Connected->value)
            ->first();

        $siteKey = $connection?->config['site_key'] ?? null;

        if ($connection === null || $siteKey === null || ! hash_equals((string) $siteKey, $validated['site_key'])) {
            abort(403);
        }

        $allowedOrigins = (array) ($connection->config['allowed_origins'] ?? []);
        $origin = (string) $request->header('Origin', '');

        if ($allowedOrigins !== [] && ! in_array($origin, $allowedOrigins, true)) {
            abort(403);
        }

        $plain = Str::random(40);
        $ttl = (int) config('channels.chat.session_ttl_minutes');

        $session = ChatSession::create([
            'channel_connection_id' => $connection->id,
            'token_hash' => ChatSession::hashToken($plain),
            'origin' => $origin !== '' ? $origin : null,
            'expires_at' => now()->addMinutes($ttl),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return response()->json([
            'token' => $plain,
            'expires_at' => $session->expires_at->toJSON(),
            'poll_seconds' => (int) config('channels.chat.poll_seconds'),
            'state' => 'awaiting_identity',
        ]);
    }

    public function messages(Request $request): JsonResponse
    {
        $session = ChatWidgetRequest::session($request);

        if ($session->ticket_id === null) {
            return response()->json(['messages' => [], 'state' => 'awaiting_identity']);
        }

        $after = (int) $request->query('after', 0);

        $messages = TicketMessage::query()
            ->where('ticket_id', $session->ticket_id)
            ->publicOnly()
            ->when($after > 0, fn ($q) => $q->where('id', '>', $after))
            ->orderBy('id')
            ->get(['id', 'author_type', 'body', 'created_at']);

        if ($messages->isNotEmpty()) {
            $session->forceFill(['last_seen_message_id' => $messages->last()->id])->saveQuietly();
        }

        return response()->json([
            'messages' => $messages->map(fn (TicketMessage $m) => [
                'id' => $m->id,
                'author_type' => $m->author_type,
                'body' => $m->body,
                'created_at' => $m->created_at->toJSON(),
            ])->all(),
            'state' => 'open',
        ]);
    }

    public function identify(Request $request): JsonResponse
    {
        $session = ChatWidgetRequest::session($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:191'],
        ]);

        if ($session->ticket_id !== null) {
            return response()->json(['state' => 'open']);
        }

        $held = $this->heldMessages($session);
        $firstBody = $held[0] ?? __('channels.inbound.default_subject', ['channel' => Channel::Chat->label()]);

        $identity = new InboundMessage(
            providerMessageId: 'chat:'.$session->id.':identify',
            channel: Channel::Chat,
            fromEmail: $validated['email'],
            fromPhone: null,
            fromName: $validated['name'],
            subject: '',
            body: $firstBody,
            threadRefs: [],
            hadAttachment: false,
            occurredAt: CarbonImmutable::now(),
        );

        $customer = $this->customers->resolve($identity);
        [$ticket] = $this->factory->create($identity, $customer);

        $session->forceFill([
            'customer_id' => $customer->id,
            'ticket_id' => $ticket->id,
            'visitor_name' => $validated['name'],
            'visitor_email' => $validated['email'],
        ])->save();

        // Replay any FURTHER held messages (index 0 already became the
        // ticket's opening description/message above) so nothing typed
        // before identification is lost.
        foreach (array_slice($held, 1) as $i => $body) {
            $this->appendHeld($session, $ticket->id, $body, $i + 1);
        }

        $this->clearHeld($session);

        return response()->json(['state' => 'open']);
    }

    public function send(Request $request): JsonResponse
    {
        $session = ChatWidgetRequest::session($request);

        $maxChars = (int) config('channels.chat.max_message_chars');
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:'.$maxChars],
        ]);

        if ($session->message_count >= (int) config('channels.chat.max_messages_per_session')) {
            abort(422, __('channels.error.chat_limit'));
        }

        $session->increment('message_count');

        if ($session->ticket_id === null) {
            $held = $this->heldMessages($session);
            $held[] = $validated['body'];
            $this->putHeld($session, $held);

            return response()->json(['state' => 'awaiting_identity']);
        }

        $this->appendHeld($session, $session->ticket_id, $validated['body'], $session->message_count);

        return response()->json(['state' => 'open']);
    }

    private function appendHeld(ChatSession $session, int $ticketId, string $body, int $n): void
    {
        $connection = $session->connection;
        $ticket = $session->ticket ?? Ticket::find($ticketId);

        $message = new InboundMessage(
            providerMessageId: 'chat:'.$session->id.':'.$n,
            channel: Channel::Chat,
            fromEmail: $session->visitor_email,
            fromPhone: null,
            fromName: $session->visitor_name,
            subject: '',
            body: $body,
            threadRefs: [],
            hadAttachment: false,
            occurredAt: CarbonImmutable::now(),
        );

        if ($connection !== null) {
            $this->ingestor->ingest($connection, $message);
        }
    }

    /** @return array<int, string> */
    private function heldMessages(ChatSession $session): array
    {
        return (array) Cache::get($this->heldKey($session), []);
    }

    /** @param array<int, string> $held */
    private function putHeld(ChatSession $session, array $held): void
    {
        Cache::put($this->heldKey($session), $held, now()->addMinutes((int) config('channels.chat.session_ttl_minutes')));
    }

    private function clearHeld(ChatSession $session): void
    {
        Cache::forget($this->heldKey($session));
    }

    private function heldKey(ChatSession $session): string
    {
        return 'chat-widget:held:'.$session->id;
    }
}
