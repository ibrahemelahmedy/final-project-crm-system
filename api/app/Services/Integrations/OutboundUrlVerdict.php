<?php

namespace App\Services\Integrations;

/** Story 25 (WIS-24). The result of one OutboundUrlGuard::validate() call. */
final readonly class OutboundUrlVerdict
{
    public function __construct(
        public bool $ok,
        /** i18n key (integrations.error.*), or null when ok. NEVER a message. */
        public ?string $error = null,
        /** The resolved IP, for the log line only. Never returned to a client. */
        public ?string $ip = null,
    ) {}

    public static function pass(string $ip): self
    {
        return new self(true, null, $ip);
    }

    public static function fail(string $errorKey): self
    {
        return new self(false, $errorKey);
    }
}
