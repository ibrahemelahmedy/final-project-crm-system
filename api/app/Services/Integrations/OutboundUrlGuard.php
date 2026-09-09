<?php

namespace App\Services\Integrations;

/**
 * Story 25 (WIS-24). The SSRF gate, extracted from HttpIntegrationTester
 * so BOTH the reachability probe and the sync engine share one
 * implementation. Runs BEFORE any socket opens. Do not weaken, skip, or
 * copy one of its checks into a caller.
 *
 * `error` is an i18n key (`integrations.error.*`), never a raw message.
 */
interface OutboundUrlGuard
{
    public function validate(string $url): OutboundUrlVerdict;
}
