<?php

return [
    /*
     * Story 19 (WIS-18). AI Assist is OFF unless a key is present. Every
     * consumer checks `enabled` — never `key` — so a deployment can disable
     * the feature without discarding its credential.
     */
    'enabled' => env('AI_ASSIST_ENABLED', true) && filled(env('ANTHROPIC_API_KEY')),

    'key' => env('ANTHROPIC_API_KEY'),

    // Do NOT append a date suffix; this id is complete as written.
    'model' => env('AI_ASSIST_MODEL', 'claude-opus-5'),

    // Both artefacts are short. `low` is the cheapest setting that holds
    // quality on this workload; raise it here, not in the service.
    'effort' => env('AI_ASSIST_EFFORT', 'low'),

    // Adaptive thinking is on by default on claude-opus-5 and its tokens
    // count against this ceiling, so it is not sized to the visible output.
    'max_tokens' => (int) env('AI_ASSIST_MAX_TOKENS', 4096),

    // Seconds. Decision 4 — the synchronous budget the SPA waits on.
    'timeout' => (int) env('AI_ASSIST_TIMEOUT', 30),

    // The newest N messages fed to the model. Bounds cost on a long thread.
    'transcript_messages' => (int) env('AI_ASSIST_TRANSCRIPT_MESSAGES', 40),

    // Per-message character clamp inside the transcript.
    'transcript_chars' => (int) env('AI_ASSIST_TRANSCRIPT_CHARS', 2000),
];
