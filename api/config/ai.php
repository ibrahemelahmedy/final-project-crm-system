<?php

/*
 * Story 19 (WIS-18) built this file for one paid provider. Story 22 (WIS-26)
 * turned it into a provider registry: `AI_PROVIDER` picks one entry from
 * `providers`, and `enabled` follows THAT entry's key. An unknown provider
 * name resolves to no entry, which disables the feature — it never throws,
 * because a config file that throws breaks `artisan config:cache`.
 */

$provider = env('AI_PROVIDER', 'anthropic');

$providers = [
    // Paid. Uses the official SDK via AnthropicAssistGenerator.
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        // Do NOT append a date suffix; this id is complete as written.
        'model' => env('AI_ASSIST_MODEL', 'claude-opus-5'),
        'base_url' => null, // the SDK owns its own endpoint
    ],

    // Free tier. OpenAI-compatible; served by OpenAiCompatibleAssistGenerator.
    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    ],

    // Free tier (Google AI Studio). Also OpenAI-compatible.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
    ],
];

$selected = $providers[$provider] ?? null;

return [
    // Which entry of `providers` is live. Never trusted blindly — see `enabled`.
    'provider' => $provider,

    'providers' => $providers,

    /*
     * AI Assist is OFF unless the SELECTED provider's key is present. Every
     * consumer checks `enabled` — never `key` — so a deployment can disable
     * the feature without discarding its credential.
     */
    'enabled' => env('AI_ASSIST_ENABLED', true) && $selected !== null && filled($selected['key']),

    // Back-compat: the selected provider's credential and model. Read by
    // AppServiceProvider's Anthropic\Client singleton and by
    // AnthropicAssistGenerator, neither of which this story edits.
    'key' => $selected['key'] ?? null,
    'model' => $selected['model'] ?? env('AI_ASSIST_MODEL', 'claude-opus-5'),

    // Anthropic-only. Read at AnthropicAssistGenerator.php:32.
    'effort' => env('AI_ASSIST_EFFORT', 'low'),

    // Adaptive thinking is on by default on claude-opus-5 and its tokens
    // count against this ceiling, so it is not sized to the visible output.
    'max_tokens' => (int) env('AI_ASSIST_MAX_TOKENS', 4096),

    // OpenAI-compatible providers only. Low, because both artefacts are
    // factual restatements of a transcript, not creative writing.
    'temperature' => (float) env('AI_ASSIST_TEMPERATURE', 0.3),

    // Seconds. Story 19 Decision 4 — the synchronous budget the SPA waits on.
    // Applied for real by OpenAiCompatibleAssistGenerator.
    'timeout' => (int) env('AI_ASSIST_TIMEOUT', 30),

    // The newest N messages fed to the model. Bounds cost on a long thread.
    'transcript_messages' => (int) env('AI_ASSIST_TRANSCRIPT_MESSAGES', 40),

    // Per-message character clamp inside the transcript.
    'transcript_chars' => (int) env('AI_ASSIST_TRANSCRIPT_CHARS', 2000),
];
