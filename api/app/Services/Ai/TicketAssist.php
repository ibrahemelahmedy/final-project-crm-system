<?php

namespace App\Services\Ai;

use App\Enums\AssistKind;
use App\Models\AiAssistArtifact;
use App\Models\Ticket;
use App\Models\User;

/**
 * Story 19 (WIS-18) — the whole state machine, so no controller holds
 * policy. Modelled on App\Services\PortalAccess.
 */
final class TicketAssist
{
    public function __construct(
        private AssistGenerator $generator,
        private AssistTranscript $transcript,
    ) {}

    /** The cached row, or null. Never generates. */
    public function existing(Ticket $ticket, AssistKind $kind): ?AiAssistArtifact
    {
        return AiAssistArtifact::query()
            ->where('ticket_id', $ticket->id)
            ->where('kind', $kind->value)
            ->first();
    }

    /**
     * Generate + upsert, replacing any prior row for this (ticket, kind).
     * Lets AssistUnavailableException propagate — the controller owns the
     * HTTP mapping.
     */
    public function generate(Ticket $ticket, AssistKind $kind, User $actor): AiAssistArtifact
    {
        $locale = app()->getLocale();

        [$system, $prompt] = $kind === AssistKind::Summary
            ? $this->transcript->forSummary($ticket, $locale)
            : $this->transcript->forReply($ticket, $locale);

        $result = $this->generator->generate($system, $prompt);

        return AiAssistArtifact::updateOrCreate(
            ['ticket_id' => $ticket->id, 'kind' => $kind->value],
            [
                'content' => $result->content,
                'model' => $result->model,
                'locale' => $locale,
                'generated_by' => $actor->id,
                'source_message_id' => $this->transcript->lastMessageId(),
                'input_tokens' => $result->inputTokens,
                'output_tokens' => $result->outputTokens,
                'dismissed_at' => null,
            ]
        );
    }

    /** Sets dismissed_at on the suggested reply. Idempotent. */
    public function dismiss(Ticket $ticket): void
    {
        AiAssistArtifact::query()
            ->where('ticket_id', $ticket->id)
            ->where('kind', AssistKind::SuggestedReply->value)
            ->whereNull('dismissed_at')
            ->update(['dismissed_at' => now()]);
    }
}
