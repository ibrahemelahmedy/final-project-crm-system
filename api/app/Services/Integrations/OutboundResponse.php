<?php

namespace App\Services\Integrations;

/** Story 25 (WIS-24). The outcome of one OutboundHttpClient call. */
final readonly class OutboundResponse
{
    private function __construct(
        public bool $ok,
        public ?int $status,
        public ?string $body,
        /** i18n key when !ok. Never a raw message. */
        public ?string $errorKey,
        /** True only for a transport failure or a retryable status. */
        public bool $retryable,
    ) {}

    public static function success(int $status, string $body): self
    {
        return new self(true, $status, $body, null, false);
    }

    /** Permanent — a non-retryable HTTP status (3xx, or a 4xx other than 408/429). */
    public static function rejected(int $status): self
    {
        return new self(false, $status, null, 'integrations.sync.error.rejected', false);
    }

    /** Retryable HTTP status: 408, 429, 5xx. */
    public static function transient(int $status): self
    {
        return new self(false, $status, null, 'integrations.sync.error.transient', true);
    }

    public static function transportFailure(): self
    {
        return new self(false, null, null, 'integrations.sync.error.unreachable', true);
    }

    /** A guard rejection at send time — always permanent. */
    public static function blocked(string $errorKey): self
    {
        return new self(false, null, null, $errorKey, false);
    }

    public static function tooLarge(): self
    {
        return new self(false, null, null, 'integrations.sync.error.payload_too_large', false);
    }
}
