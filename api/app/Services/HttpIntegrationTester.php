<?php

namespace App\Services;

use App\Services\Integrations\OutboundUrlGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 18 (WIS-19). The real IntegrationConnectionTester — one outbound
 * HTTPS reachability probe, guarded against SSRF.
 *
 * An authenticated Administrator supplying a URL the server then fetches is
 * the textbook SSRF shape, so every guard below runs BEFORE a socket opens.
 * Do not weaken or skip one.
 *
 * Story 25 (WIS-24): the four guards that used to live inline here now live
 * in OutboundUrlGuard, so the sync engine runs the SAME code. Behaviour,
 * error keys and return shape are unchanged — IntegrationSsrfTest passes
 * untouched, which is the proof the extraction was faithful.
 */
class HttpIntegrationTester implements IntegrationConnectionTester
{
    public function __construct(private readonly OutboundUrlGuard $guard) {}

    public function test(string $endpointUrl, ?string $secret): array
    {
        $verdict = $this->guard->validate($endpointUrl);

        if (! $verdict->ok) {
            return ['ok' => false, 'status' => null, 'error' => $verdict->error];
        }

        $host = parse_url($endpointUrl, PHP_URL_HOST);

        // 3. One real request. HEAD first; a 405/501 (method not supported)
        // gets one GET retry — some endpoints reject HEAD outright.
        try {
            $client = Http::withOptions(['allow_redirects' => false])
                ->timeout(5)
                ->connectTimeout(3);

            if ($secret !== null && $secret !== '') {
                $client = $client->withToken($secret);
            }

            $response = $client->head($endpointUrl);

            if (in_array($response->status(), [405, 501], true)) {
                $response = $client->get($endpointUrl);
            }
        } catch (Throwable $e) {
            // NEVER store $e->getMessage() — a Guzzle exception message can
            // embed the request headers, and the Authorization header
            // carries the secret. Log locally for operators only; the
            // caller only ever sees the translation key.
            Log::warning('Integration connection test failed', ['host' => $host]);

            return ['ok' => false, 'status' => null, 'error' => 'integrations.error.unreachable'];
        }

        // 4. Pass = a response arrived with status < 500. Reachability only
        // — a 401/403/404 still proves the endpoint exists (Decision 2).
        if ($response->status() >= 500) {
            return ['ok' => false, 'status' => $response->status(), 'error' => 'integrations.error.server_error'];
        }

        return ['ok' => true, 'status' => $response->status(), 'error' => null];
    }
}
