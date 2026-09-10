<?php

namespace App\Services\Channels;

use App\Enums\Channel;
use Carbon\CarbonImmutable;

/**
 * Story 26 (WIS-22), Decision 3. The canonical, provider-agnostic DTO every
 * adapter produces and the ingestor consumes.
 */
final readonly class InboundMessage
{
    /** @param array<int, string> $threadRefs In-Reply-To / References tail, right-most first. Empty for whatsapp/sms. */
    public function __construct(
        public string $providerMessageId,
        public Channel $channel,
        public ?string $fromEmail,
        public ?string $fromPhone,
        public ?string $fromName,
        public string $subject,
        public string $body,
        public array $threadRefs,
        public bool $hadAttachment,
        public CarbonImmutable $occurredAt,
    ) {}
}
