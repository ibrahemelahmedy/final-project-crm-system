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
        // gpt-oss-120b is on every current Groq tier; the older llama-3.3
        // ids are being retired and 404 on newer accounts.
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
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

    /*
     * Story 24 (WIS-23) — auto-classification. Runs from
     * TicketClassificationObserver on Ticket::created, deferred with
     * DB::afterCommit + app()->terminating() so the creating request never
     * waits on the provider.
     */
    'classify' => [
        'enabled' => (bool) env('AI_CLASSIFY_ENABLED', true),

        // Below this, the suggestion is DISCARDED and the ticket is flagged
        // needs_triage. Never applied automatically at any confidence —
        // see Decision 4.
        'min_confidence' => (float) env('AI_CLASSIFY_MIN_CONFIDENCE', 0.6),

        // Description clamp inside the classify prompt.
        'max_chars' => (int) env('AI_CLASSIFY_MAX_CHARS', 2000),

        // Per-process cap, mirroring mail.csat.max_per_request. There is no
        // queue worker, so an importer creating N tickets would otherwise do
        // N synchronous provider calls in one process.
        'max_per_request' => (int) env('AI_CLASSIFY_MAX_PER_REQUEST', 3),
    ],

    /*
     * Story 24 (WIS-23) — the Customer Portal chatbot. Grounded ONLY on
     * published KB articles; guardrails are enforced in PortalChatbot, not
     * by the model.
     */
    'chat' => [
        'enabled' => (bool) env('AI_CHAT_ENABLED', true),

        // Customer + assistant rows combined, per conversation.
        'max_messages' => (int) env('AI_CHAT_MAX_MESSAGES', 20),

        // Provider-reported prompt+completion tokens, accumulated per
        // conversation. A provider that reports 0 never trips this.
        'max_tokens_per_conversation' => (int) env('AI_CHAT_MAX_TOKENS', 12000),

        'max_question_chars' => (int) env('AI_CHAT_MAX_QUESTION_CHARS', 1000),

        // Top-N published articles fed into the CONTEXT block, and the
        // per-article character clamp.
        'grounding_articles' => (int) env('AI_CHAT_GROUNDING_ARTICLES', 4),
        'grounding_chars' => (int) env('AI_CHAT_GROUNDING_CHARS', 1500),

        // Newest N stored messages replayed into the transcript.
        'history_turns' => (int) env('AI_CHAT_HISTORY_TURNS', 8),

        'rate_per_minute' => (int) env('AI_CHAT_RATE_PER_MINUTE', 8),
        'rate_per_day' => (int) env('AI_CHAT_RATE_PER_DAY', 100),

        // DECLARED, NOT YET APPLIED. OpenAiCompatibleAssistGenerator reads
        // config('ai.timeout') (30s) at :39 and owns the HTTP budget; giving
        // one call a different budget needs a seam change this story
        // deliberately rejected (Decision 1). Do not mutate ai.timeout at
        // runtime to fake it.
        'timeout' => (int) env('AI_CHAT_TIMEOUT', 20),
    ],
];
