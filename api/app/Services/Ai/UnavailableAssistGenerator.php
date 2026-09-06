<?php

namespace App\Services\Ai;

use App\Exceptions\AssistUnavailableException;

/**
 * Story 19 (WIS-18). Bound when `config('ai.enabled')` is false — no key
 * configured, or the feature explicitly turned off. Always throws, so a
 * generate request degrades to the `failed` shape rather than a 500. Also
 * what a test binds to exercise the failed state without a fake HTTP layer.
 */
final class UnavailableAssistGenerator implements AssistGenerator
{
    public function generate(string $system, string $transcript): AssistResult
    {
        throw new AssistUnavailableException('AI assist is not configured.');
    }
}
