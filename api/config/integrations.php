<?php

/*
 * Story 25 (WIS-24). Every knob the sync engine reads. Nothing here throws and
 * nothing opens a connection — `artisan config:cache` must stay green.
 */
return [
    'sync' => [
        'inbound' => [
            'page_size' => (int) env('INTEGRATION_SYNC_PAGE_SIZE', 100),
            'max_pages' => (int) env('INTEGRATION_SYNC_MAX_PAGES', 50),
            'max_records_per_run' => (int) env('INTEGRATION_SYNC_MAX_RECORDS', 5000),
            // Bytes. A body larger than this fails the run and is never parsed.
            'max_response_bytes' => (int) env('INTEGRATION_SYNC_MAX_BYTES', 2 * 1024 * 1024),
            'timeout' => (int) env('INTEGRATION_SYNC_TIMEOUT', 15),
            'connect_timeout' => 5,
        ],

        'outbound' => [
            'max_attempts' => (int) env('INTEGRATION_OUTBOX_MAX_ATTEMPTS', 5),
            // Seconds before attempt N+1. Indexed by (attempts - 1); the last
            // entry repeats if max_attempts ever exceeds the array length.
            'backoff' => [60, 300, 900, 3600, 10800],
            // Messages ONE request may try to deliver inline. Bounds a
            // 100-ticket bulk resolve; never bounds the enqueue.
            'inline_max_per_request' => (int) env('INTEGRATION_OUTBOX_INLINE_MAX', 5),
            // Messages ONE `sync:flush-outbox` run drains.
            'batch_size' => (int) env('INTEGRATION_OUTBOX_BATCH', 100),
            'timeout' => (int) env('INTEGRATION_OUTBOX_TIMEOUT', 10),
            'connect_timeout' => 5,
            // Longest free-text field copied into a payload.
            'payload_max_chars' => 2000,
        ],

        // Per-row errors kept on a sync_runs row. The rest are counted only.
        'max_error_rows' => 50,

        // Master switch, OFF in tests (see api/phpunit.xml) so no existing
        // ticket/CSAT test starts enqueuing.
        'enabled' => (bool) env('INTEGRATION_SYNC_ENABLED', true),
    ],
];
