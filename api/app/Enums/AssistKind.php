<?php

namespace App\Enums;

/**
 * Story 19 (WIS-18) — the two AI-generated artefacts. One `ai_assist_artifacts`
 * row per (ticket_id, kind), replaced on regenerate.
 */
enum AssistKind: string
{
    case Summary = 'summary';
    case SuggestedReply = 'suggested_reply';
}
