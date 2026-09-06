<?php

namespace App\Services\Ai;

use App\Exceptions\AssistUnavailableException;

/**
 * Story 19 (WIS-18). The provider seam — Decision 1 in the story plan. Bound
 * in AppServiceProvider to AnthropicAssistGenerator when `config('ai.enabled')`
 * is true, otherwise to UnavailableAssistGenerator. A second provider would
 * implement this interface and be bound the same way.
 */
interface AssistGenerator
{
    /**
     * @throws AssistUnavailableException on any provider failure — the
     *                                    caller turns that into the `failed` shape and NEVER lets it
     *                                    reach the composer.
     */
    public function generate(string $system, string $transcript): AssistResult;
}
