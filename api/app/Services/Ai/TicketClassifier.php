<?php

namespace App\Services\Ai;

use App\Enums\Priority;
use App\Exceptions\AssistUnavailableException;
use App\Models\Ticket;
use Illuminate\Support\Str;

/**
 * Story 24 (WIS-23), Task 7. Classify a ticket and persist the result into
 * the six ai_* columns. NEVER writes category or priority (Decision 4).
 */
final class TicketClassifier
{
    public function __construct(
        private AssistGenerator $generator,
        private ClassificationPrompt $prompt,
    ) {}

    /** Returns true when a row was written. */
    public function classify(Ticket $ticket): bool
    {
        if (! config('ai.enabled') || ! config('ai.classify.enabled')) {
            return false;
        }

        [$system, $prompt] = $this->prompt->forTicket($ticket->loadMissing('customer'));

        try {
            $result = $this->generator->generate($system, $prompt);
        } catch (AssistUnavailableException $e) {
            // Decision 5, row 3: the ticket is COMPLETELY unaffected —
            // ai_classified_at stays null. report(), never rethrow: this runs
            // in a terminating callback, after the response was sent.
            report($e);

            return false;
        }

        $data = JsonAnswer::parse($result->content) ?? [];

        $category = is_string($data['category'] ?? null) ? $data['category'] : null;
        $priority = is_string($data['priority'] ?? null) ? $data['priority'] : null;
        $confidence = is_numeric($data['confidence'] ?? null) ? (float) $data['confidence'] : 0.0;
        $confidence = max(0.0, min(1.0, $confidence));

        $valid = in_array($category, Ticket::CATEGORIES, true)
            && Priority::tryFrom((string) $priority) !== null;

        $confident = $valid && $confidence >= (float) config('ai.classify.min_confidence');

        // A BASE-builder update: an Eloquent update would fire Ticket::booted()
        // and TicketResolutionObserver for something that is not a lifecycle
        // event. Same discipline as PortalFaqController::show():57.
        Ticket::query()->whereKey($ticket->id)->toBase()->update([
            'ai_suggested_category' => $confident ? $category : null,
            'ai_suggested_priority' => $confident ? $priority : null,
            'ai_confidence' => $confidence,
            'ai_classified_at' => now(),
            'ai_classification_model' => Str::limit($result->model, 64, ''),
            'needs_triage' => ! $confident,
            'updated_at' => $ticket->updated_at, // do NOT bump the queue's sort key
        ]);

        return true;
    }
}
