<?php

use App\Services\Ai\AnthropicAssistGenerator;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\OpenAiCompatibleAssistGenerator;
use App\Services\Ai\UnavailableAssistGenerator;

/**
 * Story 22 (WIS-26), Test Plan B. Resolves `AssistGenerator` from the
 * container after a runtime `config([...])`. The binding is a `bind`, so each
 * `app(AssistGenerator::class)` re-runs the closure. Do NOT call
 * bindAssistGenerator() here or the fake masks what is under test.
 */
it('binds the anthropic generator when the provider is anthropic', function () {
    config(['ai.enabled' => true, 'ai.provider' => 'anthropic']);

    expect(app(AssistGenerator::class))->toBeInstanceOf(AnthropicAssistGenerator::class);
});

it('binds one OpenAI-compatible generator for groq and for gemini', function (string $provider) {
    config([
        'ai.enabled' => true,
        'ai.provider' => $provider,
        "ai.providers.{$provider}.key" => 'test-key',
    ]);

    expect(app(AssistGenerator::class))->toBeInstanceOf(OpenAiCompatibleAssistGenerator::class);
})->with(['groq', 'gemini']);

it('binds the unavailable generator when the selected provider has no key', function () {
    config(['ai.enabled' => false, 'ai.provider' => 'groq']);

    expect(app(AssistGenerator::class))->toBeInstanceOf(UnavailableAssistGenerator::class);
});

it('binds the unavailable generator for an unknown provider name', function () {
    config(['ai.enabled' => true, 'ai.provider' => 'not-a-provider']);

    $generator = app(AssistGenerator::class);

    expect($generator)->toBeInstanceOf(UnavailableAssistGenerator::class);
});

it('registers three providers, each with a key, model and base url slot', function () {
    expect(array_keys(config('ai.providers')))->toBe(['anthropic', 'groq', 'gemini']);

    foreach (config('ai.providers') as $entry) {
        expect($entry)->toHaveKeys(['key', 'model', 'base_url']);
    }
});
