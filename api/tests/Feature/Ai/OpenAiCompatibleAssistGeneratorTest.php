<?php

use App\Exceptions\AssistUnavailableException;
use App\Services\Ai\OpenAiCompatibleAssistGenerator;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Story 22 (WIS-26), Test Plan A. Follows IntegrationSsrfTest: Http::fake()
 * per test, the generator constructed directly (constructor arguments — no
 * container), no RefreshDatabase (nothing here touches the database).
 */
beforeEach(function () {
    Http::preventStrayRequests();
});

function groqGenerator(): OpenAiCompatibleAssistGenerator
{
    return new OpenAiCompatibleAssistGenerator(
        provider: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key',
        model: 'llama-3.3-70b-versatile',
    );
}

it('maps a successful completion to an AssistResult', function () {
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => ' Two short lines. '], 'finish_reason' => 'stop']],
        'usage' => ['prompt_tokens' => 120, 'completion_tokens' => 44],
        'model' => 'llama-3.3-70b-versatile',
    ])]);

    $result = groqGenerator()->generate('sys', 'transcript');

    expect($result->content)->toBe('Two short lines.')
        ->and($result->model)->toBe('llama-3.3-70b-versatile')
        ->and($result->inputTokens)->toBe(120)
        ->and($result->outputTokens)->toBe(44);
});

it('posts the OpenAI chat-completions shape with a bearer token', function () {
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'ok'], 'finish_reason' => 'stop']],
    ])]);

    groqGenerator()->generate('SYSTEM-PROMPT', 'THE-TRANSCRIPT');

    Http::assertSent(function ($request) {
        $body = $request->data();

        return str_ends_with($request->url(), '/chat/completions')
            && $request->hasHeader('Authorization', 'Bearer test-key')
            && $body['messages'][0]['role'] === 'system'
            && $body['messages'][0]['content'] === 'SYSTEM-PROMPT'
            && $body['messages'][1]['role'] === 'user'
            && $body['messages'][1]['content'] === 'THE-TRANSCRIPT'
            && $body['model'] === 'llama-3.3-70b-versatile'
            && $body['max_tokens'] === (int) config('ai.max_tokens')
            && $body['temperature'] === (float) config('ai.temperature');
    });
});

it('works against the gemini base url with no code change', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'ok'], 'finish_reason' => 'stop']],
    ])]);

    (new OpenAiCompatibleAssistGenerator(
        provider: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
    ))->generate('sys', 'transcript');

    Http::assertSent(fn ($request) => $request->url()
        === 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
});

it('maps a 429 to AssistUnavailableException without leaking the key', function () {
    Http::fake(['api.groq.com/*' => Http::response('rate limited for test-key', 429)]);

    try {
        groqGenerator()->generate('sys', 'transcript');
        $this->fail('expected AssistUnavailableException');
    } catch (AssistUnavailableException $e) {
        expect($e->getMessage())->toBe('groq http 429')
            ->and($e->getMessage())->not->toContain('test-key');
    }
});

it('maps a 500 to AssistUnavailableException', function () {
    Http::fake(['api.groq.com/*' => Http::response('boom', 500)]);

    expect(fn () => groqGenerator()->generate('sys', 'transcript'))
        ->toThrow(AssistUnavailableException::class, 'groq http 500');
});

it('maps a connection failure to AssistUnavailableException', function () {
    Http::fake(fn () => throw new ConnectionException('cURL error 28: timed out'));

    try {
        groqGenerator()->generate('sys', 'transcript');
        $this->fail('expected AssistUnavailableException');
    } catch (AssistUnavailableException $e) {
        expect($e->getMessage())->toBe('groq transport failure')
            ->and($e->getMessage())->not->toContain('cURL');
    }
});

it('treats finish_reason content_filter as a refusal', function () {
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'this should never be read'], 'finish_reason' => 'content_filter']],
    ])]);

    expect(fn () => groqGenerator()->generate('sys', 'transcript'))
        ->toThrow(AssistUnavailableException::class, 'refused');
});

it('treats an empty or whitespace completion as unavailable', function (array $payload) {
    Http::fake(['api.groq.com/*' => Http::response($payload['body'], 200, $payload['headers'] ?? [])]);

    expect(fn () => groqGenerator()->generate('sys', 'transcript'))
        ->toThrow(AssistUnavailableException::class, 'empty completion');
})->with([
    'empty string' => [['body' => ['choices' => [['message' => ['content' => ''], 'finish_reason' => 'stop']]]]],
    'whitespace' => [['body' => ['choices' => [['message' => ['content' => "   \n  "], 'finish_reason' => 'stop']]]]],
    'no choices' => [['body' => ['choices' => []]]],
    'non-json body' => [['body' => '<html>proxy error</html>', 'headers' => ['Content-Type' => 'text/html']]],
]);

it('clamps a model id longer than the 64-character column', function () {
    $longModel = str_repeat('a', 90);
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'ok'], 'finish_reason' => 'stop']],
        'model' => $longModel,
    ])]);

    $result = groqGenerator()->generate('sys', 'transcript');

    expect(strlen($result->model))->toBe(64)
        ->and($result->model)->not->toContain('.');
});

it('returns the content when finish_reason is length', function () {
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'A truncated but usable summary.'], 'finish_reason' => 'length']],
    ])]);

    expect(groqGenerator()->generate('sys', 'transcript')->content)
        ->toBe('A truncated but usable summary.');
});

it('defaults token counts to zero when usage is absent', function () {
    Http::fake(['api.groq.com/*' => Http::response([
        'choices' => [['message' => ['content' => 'ok'], 'finish_reason' => 'stop']],
    ])]);

    $result = groqGenerator()->generate('sys', 'transcript');

    expect($result->inputTokens)->toBe(0)->and($result->outputTokens)->toBe(0);
});
