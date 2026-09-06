<?php

namespace App\Services;

/**
 * Story 18 (WIS-19). The seam over "make one outbound reachability request".
 *
 * Bound to App\Services\HttpIntegrationTester in AppServiceProvider. Every
 * test in the suite binds a fake implementation instead — no test performs a
 * real outbound request.
 */
interface IntegrationConnectionTester
{
    /**
     * Verifies the endpoint is REACHABLE, not that the credential is
     * accepted — a 401 from the far side still counts as `ok: true`. See
     * Decision 2 in the story plan.
     *
     * `error` is an i18n key (`integrations.error.*`), NEVER a raw exception
     * message — a transport-layer message can embed the Authorization
     * header, and the header carries the secret.
     *
     * @return array{ok: bool, status: int|null, error: string|null}
     */
    public function test(string $endpointUrl, ?string $secret): array;
}
