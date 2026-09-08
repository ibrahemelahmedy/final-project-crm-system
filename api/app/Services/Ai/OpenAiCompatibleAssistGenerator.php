<?php

namespace App\Services\Ai;

use App\Exceptions\AssistUnavailableException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Story 22 (WIS-26), Decision 1 — ONE class for every OpenAI-compatible
 * provider. Groq and Google AI Studio both serve
 * `POST {base}/chat/completions` with a Bearer key, so base URL + model + key
 * are constructor arguments and AppServiceProvider supplies them from
 * config('ai.providers.<provider>'). Adding a third such provider is a config
 * entry, not a class.
 *
 * Every failure path ends in AssistUnavailableException — see Decision 7:
 * the message is CONSTRUCTED, never forwarded from the provider or from
 * Guzzle, because a Guzzle message can embed the Authorization header.
 */
final class OpenAiCompatibleAssistGenerator implements AssistGenerator
{
    public function __construct(
        private string $provider,   // 'groq' | 'gemini' — for log/exception text only
        private string $baseUrl,
        private string $apiKey,
        private string $model,
    ) {}

    public function generate(string $system, string $transcript): AssistResult
    {
        try {
            $response = Http::withToken($this->apiKey)
                ->timeout((int) config('ai.timeout'))
                ->connectTimeout(10)
                ->acceptJson()
                ->asJson()
                ->post(rtrim($this->baseUrl, '/').'/chat/completions', [
                    'model' => $this->model,
                    // Decision 5 — the system prompt is its own turn.
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $transcript],
                    ],
                    'max_tokens' => (int) config('ai.max_tokens'),
                    'temperature' => (float) config('ai.temperature'),
                ]);
        } catch (Throwable $e) {
            // Connection refused, DNS failure, timeout. NEVER $e->getMessage().
            throw new AssistUnavailableException(
                $this->provider.' transport failure', previous: $e
            );
        }

        // 401 / 403 / 429 / 5xx all land here. No retry (Decision 8).
        if ($response->failed()) {
            throw new AssistUnavailableException(
                $this->provider.' http '.$response->status()
            );
        }

        $data = $response->json() ?? [];
        $choice = $data['choices'][0] ?? null;

        // A content filter declines with HTTP 200. Check BEFORE reading
        // content, or an empty draft lands in the composer.
        if (($choice['finish_reason'] ?? null) === 'content_filter') {
            throw new AssistUnavailableException('refused');
        }

        $text = trim((string) ($choice['message']['content'] ?? ''));

        // Decision 9 — `length` with content is a success; empty is not.
        if ($text === '') {
            throw new AssistUnavailableException('empty completion');
        }

        return new AssistResult(
            $text,
            // Decision 6 — ai_assist_artifacts.model is string(64).
            Str::limit((string) ($data['model'] ?? $this->model), 64, ''),
            (int) ($data['usage']['prompt_tokens'] ?? 0),
            (int) ($data['usage']['completion_tokens'] ?? 0),
        );
    }
}
