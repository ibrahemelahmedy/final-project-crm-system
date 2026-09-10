<?php

/*
 * Story 26 (WIS-22). Every knob the channel-ingestion engine reads. Nothing
 * here throws and nothing opens a connection — `artisan config:cache` must
 * stay green (the rule api/config/integrations.php follows).
 */
return [
    // Master switch. OFF in tests (api/phpunit.xml) so no existing ticket/reply
    // test starts enqueuing or ingesting. A not-connected channel still moves
    // nothing even when this is true.
    'enabled' => (bool) env('CHANNELS_ENABLED', true),

    'inbound' => [
        // Bytes. A webhook body larger than this is rejected 413 BEFORE the
        // HMAC is computed — hashing an unbounded body is the cheap DoS.
        'max_body_bytes' => (int) env('CHANNEL_WEBHOOK_MAX_BYTES', 512 * 1024),
        // Longest inbound body copied into ticket_messages.body.
        'max_message_chars' => (int) env('CHANNEL_MESSAGE_MAX_CHARS', 5000),
        // Messages one webhook request may ingest (a WhatsApp envelope can
        // carry several).
        'max_per_request' => (int) env('CHANNEL_INBOUND_MAX_PER_REQUEST', 10),
        // Decision 6: how recently a ticket must have been touched to absorb a
        // phone-matched reply instead of a new ticket being opened.
        'thread_window_hours' => (int) env('CHANNEL_THREAD_WINDOW_HOURS', 72),
        // Decision 6's email fallback. Matched against the subject.
        'subject_token_pattern' => '/\[#(\d+)\]/',
    ],

    'outbound' => [
        'max_attempts' => (int) env('CHANNEL_OUTBOUND_MAX_ATTEMPTS', 5),
        // Seconds before attempt N+1, indexed by (attempts - 1); the last
        // entry repeats. Same ladder as config('integrations.sync.outbound.backoff').
        'backoff' => [60, 300, 900, 3600, 10800],
        // Deliveries ONE request may attempt inline. Bounds a burst of replies;
        // never bounds the enqueue, or replies vanish.
        'inline_max_per_request' => (int) env('CHANNEL_OUTBOUND_INLINE_MAX', 3),
        'batch_size' => (int) env('CHANNEL_OUTBOUND_BATCH', 100),
        'timeout' => (int) env('CHANNEL_OUTBOUND_TIMEOUT', 10),
        'connect_timeout' => 5,
    ],

    'chat' => [
        'poll_seconds' => (int) env('CHANNEL_CHAT_POLL_SECONDS', 5),
        'session_ttl_minutes' => (int) env('CHANNEL_CHAT_SESSION_TTL', 240),
        'max_messages_per_session' => (int) env('CHANNEL_CHAT_MAX_MESSAGES', 100),
        'max_message_chars' => (int) env('CHANNEL_CHAT_MAX_CHARS', 2000),
    ],

    // Provider base URLs are CONFIG, never read from a response body
    // (WIS-24 Decision 7 applied here). Guard-validated at send time regardless.
    'providers' => [
        'whatsapp_cloud' => [
            'base_url' => env('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com/v21.0'),
        ],
        'twilio_sms' => [
            'base_url' => env('TWILIO_BASE_URL', 'https://api.twilio.com/2010-04-01'),
        ],
        'email_webhook' => [
            'domain' => env('CHANNEL_EMAIL_DOMAIN', 'wisal.example.com'),
        ],
        'wisal_chat' => [],
    ],
];
