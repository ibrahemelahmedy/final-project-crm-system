<?php

namespace App\Services\Ai;

use App\Enums\Channel;
use App\Enums\ChatReplyState;
use App\Enums\MessageVisibility;
use App\Enums\PortalChatState;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Exceptions\AssistUnavailableException;
use App\Models\Customer;
use App\Models\PortalChatConversation;
use App\Models\PortalChatMessage;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Services\SlaClock;
use App\Services\TicketAssigner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Story 24 (WIS-23), Tasks 14-15. Owns every chatbot guardrail. The generator
 * is only ever reached after the ceilings, the feature gates and the grounding
 * short-circuit have all passed.
 */
final class PortalChatbot
{
    public function __construct(
        private AssistGenerator $generator,
        private KbGrounding $grounding,
        private ChatPrompt $prompt,
    ) {}

    /** The live conversation for this session, or null. Never creates. */
    public function existing(PortalSession $session): ?PortalChatConversation
    {
        return PortalChatConversation::query()
            ->where('portal_session_id', $session->id)
            ->where('state', PortalChatState::Active->value)
            ->latest('id')
            ->first();
    }

    /** The live conversation, created on first use. */
    public function conversationFor(PortalSession $session, string $locale): PortalChatConversation
    {
        return PortalChatConversation::firstOrCreate(
            ['portal_session_id' => $session->id, 'state' => PortalChatState::Active->value],
            ['customer_id' => $session->customer_id, 'locale' => $locale],
        );
    }

    /** @return array{state: ChatReplyState, message: ?PortalChatMessage} */
    public function ask(PortalChatConversation $conversation, string $question): array
    {
        // 1. Ceilings FIRST — before storing anything and before the provider.
        if ($conversation->state !== PortalChatState::Active || ! $conversation->hasCapacity()) {
            if ($conversation->state === PortalChatState::Active) {
                $conversation->update(['state' => PortalChatState::Ended->value]);
            }

            return ['state' => ChatReplyState::Ended, 'message' => null];
        }

        // 2. Feature gates.
        if (! config('ai.enabled') || ! config('ai.chat.enabled')) {
            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        // 3. Store the question. It survives every downstream failure so a
        //    retry never loses what the customer typed.
        $this->append($conversation, PortalChatMessage::ROLE_CUSTOMER, $question, [], 0, 0);

        // 4. Ground. Zero articles => canned refusal, NO provider call.
        $articles = $this->grounding->forQuestion($question);

        if ($articles->isEmpty()) {
            $reply = $this->append(
                $conversation, PortalChatMessage::ROLE_ASSISTANT,
                __('ai.chat_no_answer'), [], 0, 0
            );

            return ['state' => ChatReplyState::Refused, 'message' => $reply];
        }

        // 5. Call.
        $newestId = (int) $conversation->messages()->max('id');
        $history = $conversation->messages()
            ->where('id', '<', $newestId)
            ->reorder('id', 'desc')
            ->limit((int) config('ai.chat.history_turns'))
            ->get()->sortBy('id')->values();

        [$system, $transcript] = $this->prompt->build(
            $this->grounding->render($articles), $history, $question, $conversation->locale
        );

        try {
            $result = $this->generator->generate($system, $transcript);
        } catch (AssistUnavailableException $e) {
            report($e); // the provider's reason is LOGGED, never returned

            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        $data = JsonAnswer::parse($result->content);

        if ($data === null || ! is_string($data['answer'] ?? null) || trim($data['answer']) === '') {
            report(new AssistUnavailableException('unparseable chat answer'));

            return ['state' => ChatReplyState::Unavailable, 'message' => null];
        }

        $refused = (bool) ($data['refused'] ?? false);
        $slugs = array_values(array_filter((array) ($data['citations'] ?? []), 'is_string'));
        $citations = $refused ? [] : $this->grounding->citations($articles, $slugs);

        $reply = $this->append(
            $conversation, PortalChatMessage::ROLE_ASSISTANT, trim($data['answer']),
            $citations, $result->inputTokens, $result->outputTokens
        );

        return [
            'state' => $refused ? ChatReplyState::Refused : ChatReplyState::Ok,
            'message' => $reply,
        ];
    }

    /**
     * Decision 15: this is PortalRequestController::store() (:101-153) with the
     * TRANSCRIPT as the body source. Same transaction, same assigner, same
     * SlaClock ordering, same description-becomes-first-message rule.
     */
    public function escalate(PortalChatConversation $conversation, Customer $customer): Ticket
    {
        return DB::transaction(function () use ($conversation, $customer) {
            $body = $this->renderTranscript($conversation);

            $firstQuestion = $conversation->messages()
                ->where('role', PortalChatMessage::ROLE_CUSTOMER)
                ->orderBy('id')->value('body');

            $data = [
                'subject' => Str::limit(
                    $firstQuestion ?: __('ai.chat_escalation_subject'), 120, ''
                ),
                'description' => $body,
                'customer_id' => $customer->id,
                'created_by' => null,
                'status' => TicketStatus::Open->value,
                'channel' => Channel::Chat->value,
                // Explicit, not left to the column default — SlaClock::applyTo()
                // needs a real Priority instance (PortalRequestController:114-115).
                'priority' => Priority::Normal->value,
                'category' => 'general',
            ];

            $picked = app(TicketAssigner::class)->pick();
            if ($picked !== null) {
                $data['assigned_to'] = $picked->id;
            }

            $ticket = Ticket::create($data);
            app(SlaClock::class)->applyTo($ticket);
            $ticket->save();

            if ($picked !== null) {
                $ticket->recordAutoAssigned($ticket->assigned_to);
            }

            $ticket->messages()->create([
                'author_type' => TicketMessage::AUTHOR_CUSTOMER,
                'user_id' => null,
                'customer_id' => $customer->id,
                'channel' => Channel::Chat->value,
                'body' => $body,
                'visibility' => MessageVisibility::Public->value,
            ]);

            $conversation->update([
                'state' => PortalChatState::Escalated->value,
                'escalated_ticket_id' => $ticket->id,
            ]);

            return $ticket;
        });
    }

    /**
     * Creates the PortalChatMessage AND increments the conversation's counters
     * in one transaction, so counters can never drift from rows.
     *
     * @param  array<int, array{id: int, slug: string, title: string}>  $citations
     */
    private function append(
        PortalChatConversation $conversation,
        string $role,
        string $body,
        array $citations,
        int $inputTokens,
        int $outputTokens,
    ): PortalChatMessage {
        return DB::transaction(function () use (
            $conversation, $role, $body, $citations, $inputTokens, $outputTokens
        ) {
            $message = $conversation->messages()->create([
                'role' => $role,
                'body' => $body,
                'citations' => $citations === [] ? null : $citations,
                'input_tokens' => $inputTokens,
                'output_tokens' => $outputTokens,
            ]);

            $conversation->increment('message_count');
            if ($inputTokens > 0 || $outputTokens > 0) {
                $conversation->increment('input_tokens', $inputTokens);
                $conversation->increment('output_tokens', $outputTokens);
            }

            return $message;
        });
    }

    private function renderTranscript(PortalChatConversation $conversation): string
    {
        $lines = ['['.__('ai.chat_transcript_header').']'];

        foreach ($conversation->messages()->orderBy('id')->get() as $message) {
            $who = $message->role === PortalChatMessage::ROLE_CUSTOMER
                ? __('ai.chat_transcript_customer')
                : __('ai.chat_transcript_assistant');
            $lines[] = $who.': '.Str::limit((string) $message->body, 2000);
        }

        return Str::limit(implode("\n", $lines), 5000, '');
    }
}
