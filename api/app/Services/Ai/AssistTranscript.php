<?php

namespace App\Services\Ai;

use App\Enums\MessageVisibility;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Story 19 (WIS-18) — the prompt builder. No HTTP, no model calls: unit
 * testable in isolation. See the story plan's Decision 2 — `forReply()`
 * filters through `TicketMessage::scopePublicOnly()` IN THE QUERY; `forSummary()`
 * does not, because the summary is an agent-only surface.
 */
final class AssistTranscript
{
    private const SUMMARY_SYSTEM = 'You are summarising a customer-support ticket for the support agent handling it. Write 2 to 4 short lines of plain prose. State what the customer needed, what has been done, and where the ticket stands now. The transcript may contain internal agent notes; you may use them, since only agents read this summary. Do not address the customer. Do not use markdown, headings, or bullet points. Do not invent facts that are not in the transcript.';

    private const REPLY_SYSTEM = "You are drafting a reply that a human support agent will review before sending to the customer. Write one short paragraph in the same tone as the agent's previous replies in this thread. Address the customer directly. Do not promise anything the transcript does not support, do not invent order numbers, dates, refunds, or policies, and do not include a subject line, a signature, or placeholders such as [name]. Do not use markdown. If the transcript does not contain enough information to reply usefully, say briefly that you need more detail.";

    private ?int $lastMessageId = null;

    /** All messages, internal notes included (Decision 2). */
    public function forSummary(Ticket $ticket, string $locale): array
    {
        $messages = $this->window($ticket->messages());

        return [
            $this->localize(self::SUMMARY_SYSTEM, $locale, forSummary: true),
            $this->render($ticket, $messages, includeInternal: true),
        ];
    }

    /** publicOnly() IN THE QUERY (Decision 2). */
    public function forReply(Ticket $ticket, string $locale): array
    {
        $messages = $this->window($ticket->messages()->publicOnly());

        return [
            $this->localize(self::REPLY_SYSTEM, $locale, forSummary: false),
            $this->render($ticket, $messages, includeInternal: false),
        ];
    }

    /** The newest message id present in the last built transcript, or null. */
    public function lastMessageId(): ?int
    {
        return $this->lastMessageId;
    }

    /**
     * `$ticket->messages()` is pre-ordered `orderBy('id')` ASC by the
     * relation (Ticket::messages()); `reorder()` replaces that with DESC so
     * the newest-N window is taken from the recent end, then re-sorted
     * ascending in PHP for the transcript's chronological read order.
     *
     * @param  HasMany|Builder  $query
     * @return Collection<int, TicketMessage>
     */
    private function window($query)
    {
        return $query->reorder('id', 'desc')
            ->limit((int) config('ai.transcript_messages'))
            ->get()
            ->sortBy('id')
            ->values();
    }

    private function localize(string $system, string $locale, bool $forSummary): string
    {
        if ($locale !== 'ar') {
            return $system;
        }

        $instruction = $forSummary
            ? 'Write the summary in Arabic.'
            : 'Write the reply in Arabic.';

        return $system.' '.$instruction;
    }

    /** @param Collection<int, TicketMessage> $messages */
    private function render(Ticket $ticket, $messages, bool $includeInternal): string
    {
        $this->lastMessageId = $messages->last()?->id;

        $lines = [
            'Subject: '.$ticket->subject,
            'Status: '.$ticket->status->label(),
            'Priority: '.$ticket->priority->label(),
            '',
        ];

        foreach ($messages as $message) {
            $lines[] = $this->renderLine($message, $includeInternal);
        }

        return implode("\n", $lines);
    }

    private function renderLine(TicketMessage $message, bool $includeInternal): string
    {
        $name = match (true) {
            $message->author_type === TicketMessage::AUTHOR_CUSTOMER => $message->customer?->name ?? 'Customer',
            $message->author_type === TicketMessage::AUTHOR_AGENT => $message->author?->name ?? 'Agent',
            default => 'System',
        };

        $noteTag = ($includeInternal && $message->visibility === MessageVisibility::Internal)
            ? '[INTERNAL NOTE] '
            : '';

        $body = Str::limit($message->body, (int) config('ai.transcript_chars'));

        return sprintf(
            '[%s] %s · %s · %s%s%s',
            $message->author_type,
            $name,
            $message->channel->value,
            $message->created_at?->toIso8601String() ?? '',
            "\n",
            $noteTag.$body,
        );
    }
}
