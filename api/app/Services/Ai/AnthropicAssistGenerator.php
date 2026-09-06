<?php

namespace App\Services\Ai;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\RateLimitException;
use App\Exceptions\AssistUnavailableException;

/**
 * Story 19 (WIS-18), Decision 1 — Anthropic Messages API via the official
 * PHP SDK, model `claude-opus-5`, adaptive thinking at `effort: 'low'`.
 */
final class AnthropicAssistGenerator implements AssistGenerator
{
    public function __construct(private Client $client) {}

    public function generate(string $system, string $transcript): AssistResult
    {
        try {
            $message = $this->client->messages->create(
                maxTokens: (int) config('ai.max_tokens'),
                messages: [['role' => 'user', 'content' => $transcript]],
                model: (string) config('ai.model'),
                system: [
                    // The system prompt is stable per kind and goes FIRST so
                    // the cache prefix survives across tickets.
                    ['type' => 'text', 'text' => $system, 'cacheControl' => ['type' => 'ephemeral']],
                ],
                thinking: ['type' => 'adaptive'],
                outputConfig: ['effort' => config('ai.effort')],
            );
        } catch (RateLimitException|APIStatusException|APIConnectionException $e) {
            throw new AssistUnavailableException($e->getMessage(), previous: $e);
        }

        // A safety classifier can decline with HTTP 200. Check BEFORE reading
        // content, or an empty draft lands in the composer.
        if ($message->stopReason === 'refusal') {
            throw new AssistUnavailableException('refused');
        }

        $text = '';
        foreach ($message->content as $block) {
            // Adaptive thinking puts a ThinkingBlock first — never index [0].
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        if (trim($text) === '') {
            throw new AssistUnavailableException('empty completion');
        }

        return new AssistResult(
            trim($text),
            $message->model ?? (string) config('ai.model'),
            $message->usage->inputTokens ?? 0,
            $message->usage->outputTokens ?? 0,
        );
    }
}
