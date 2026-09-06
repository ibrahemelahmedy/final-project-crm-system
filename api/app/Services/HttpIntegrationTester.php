<?php

namespace App\Services;

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
 */
class HttpIntegrationTester implements IntegrationConnectionTester
{
    public function test(string $endpointUrl, ?string $secret): array
    {
        $parts = parse_url($endpointUrl);
        $scheme = $parts['scheme'] ?? null;
        $host = $parts['host'] ?? null;

        // 1. Scheme guard. http, file, gopher, ftp — all rejected before any
        // DNS resolution.
        if ($scheme !== 'https' || $host === null) {
            return ['ok' => false, 'status' => null, 'error' => 'integrations.error.scheme'];
        }

        // 2. SSRF guard. Reject a bare-IP host and a hostname with no dot
        // (localhost, container names) outright, then resolve and reject a
        // private, loopback, link-local, or reserved address.
        if (! str_contains($host, '.') && ! str_contains($host, ':')) {
            return ['ok' => false, 'status' => null, 'error' => 'integrations.error.blocked_host'];
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        if ($ip === $host && ! filter_var($host, FILTER_VALIDATE_IP)) {
            // gethostbyname() returns the input unchanged when resolution
            // fails.
            return ['ok' => false, 'status' => null, 'error' => 'integrations.error.unreachable'];
        }

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return ['ok' => false, 'status' => null, 'error' => 'integrations.error.blocked_host'];
        }

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
