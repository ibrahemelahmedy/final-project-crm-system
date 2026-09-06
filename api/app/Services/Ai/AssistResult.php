<?php

namespace App\Services\Ai;

/**
 * Story 19 (WIS-18). The provider-agnostic result of one generation call.
 */
final readonly class AssistResult
{
    public function __construct(
        public string $content,
        public string $model,
        public int $inputTokens,
        public int $outputTokens,
    ) {}
}
