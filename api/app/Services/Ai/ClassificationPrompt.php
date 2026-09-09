<?php

namespace App\Services\Ai;

use App\Models\Ticket;
use Illuminate\Support\Str;

/**
 * Story 24 (WIS-23), Task 7. Modelled on AssistTranscript: a private const
 * system string, one public method returning [$system, $prompt], no HTTP.
 *
 * The system prompt is English-only and never localised — its output is enum
 * values, not prose.
 */
final class ClassificationPrompt
{
    private const SYSTEM = <<<'TXT'
You are a support-ticket triage classifier. You will be given one ticket's subject and description.

Reply with ONE JSON object and nothing else. No prose, no explanation, no markdown, no code fence.

The object has exactly these keys:
  "category"   - one of: general, billing, technical, account, feature_request
  "priority"   - one of: low, normal, high, urgent
  "confidence" - a number between 0 and 1: how confident you are that BOTH values above are correct
  "reason"     - at most 140 characters, in English, explaining the choice

Priority guidance. "urgent": a total outage, a security or data-loss incident, or money already
lost. "high": the customer is blocked and has no workaround. "normal": the default for a real
problem that is not blocking. "low": questions, feedback, and feature requests.

If the text is empty, too short, or unintelligible, still answer, but set "confidence" to 0.3 or
lower. Never output a category or priority that is not in the lists above. Never add keys.
TXT;

    /** @return array{0: string, 1: string} */
    public function forTicket(Ticket $ticket): array
    {
        $description = trim((string) $ticket->description);

        $prompt = implode("\n", [
            'Subject: '.$ticket->subject,
            'Channel: '.$ticket->channel->value,
            'Customer tier: '.($ticket->customer?->tier?->value ?? 'unknown'),
            '',
            $description === ''
                ? '(no description provided)'
                : Str::limit($description, (int) config('ai.classify.max_chars')),
        ]);

        return [self::SYSTEM, $prompt];
    }
}
