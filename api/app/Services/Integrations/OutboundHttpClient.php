<?php

namespace App\Services\Integrations;

use App\Models\Integration;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 25 (WIS-24). The ONLY place in this story that opens a socket. Both
 * `get()` and `post()` re-validate the URL through OutboundUrlGuard at send
 * time, every time — the stored URL can be edited between configuration and
 * dispatch (Decision 1).
 */
class OutboundHttpClient
{
    public function __construct(private readonly OutboundUrlGuard $guard) {}

    /** @param array<string, scalar> $query */
    public function get(Integration $integration, string $url, array $query = []): OutboundResponse
    {
        $verdict = $this->guard->validate($url);

        if (! $verdict->ok) {
            return OutboundResponse::blocked($verdict->error);
        }

        $timeout = (int) config('integrations.sync.inbound.timeout');
        $connectTimeout = (int) config('integrations.sync.inbound.connect_timeout');

        try {
            $client = Http::withOptions(['allow_redirects' => false])
                ->timeout($timeout)
                ->connectTimeout($connectTimeout)
                ->acceptJson();

            $secret = $this->secretFor($integration);
            if ($secret !== null && $secret !== '') {
                $client = $client->withToken($secret);
            }

            $response = $client->get($url, $query);
        } catch (Throwable $e) {
            // NEVER store or return $e->getMessage() — a transport exception
            // can embed the Authorization header. Reading $integration->secret
            // can itself throw DecryptException after an APP_KEY rotation
            // (Integration.php:16-21); this catch covers that too.
            Log::warning('Integration sync request failed', [
                'host' => parse_url($url, PHP_URL_HOST),
                'exception' => $e::class,
            ]);

            return OutboundResponse::transportFailure();
        }

        $maxBytes = (int) config('integrations.sync.inbound.max_response_bytes');

        if (strlen($response->body()) > $maxBytes) {
            return OutboundResponse::tooLarge();
        }

        return $this->classify($response->status(), $response->body());
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $headers
     */
    public function post(Integration $integration, string $url, array $payload, array $headers = []): OutboundResponse
    {
        $verdict = $this->guard->validate($url);

        if (! $verdict->ok) {
            return OutboundResponse::blocked($verdict->error);
        }

        $timeout = (int) config('integrations.sync.outbound.timeout');
        $connectTimeout = (int) config('integrations.sync.outbound.connect_timeout');

        try {
            $secret = $this->secretFor($integration);
            $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            $allHeaders = [
                ...$headers,
                'User-Agent' => 'Wisal-CRM/1.0',
            ];

            if ($secret !== null && $secret !== '') {
                $allHeaders['X-Wisal-Signature'] = 'sha256='.hash_hmac('sha256', (string) $json, $secret);
            }

            $client = Http::withOptions(['allow_redirects' => false])
                ->timeout($timeout)
                ->connectTimeout($connectTimeout)
                ->acceptJson()
                ->withHeaders($allHeaders);

            if ($secret !== null && $secret !== '') {
                $client = $client->withToken($secret);
            }

            $response = $client->withBody((string) $json, 'application/json')->post($url);
        } catch (Throwable $e) {
            Log::warning('Integration sync request failed', [
                'host' => parse_url($url, PHP_URL_HOST),
                'exception' => $e::class,
            ]);

            return OutboundResponse::transportFailure();
        }

        return $this->classify($response->status(), $response->body());
    }

    /** Decision 3's outcome table. */
    private function classify(int $status, string $body): OutboundResponse
    {
        if ($status >= 200 && $status < 300) {
            return OutboundResponse::success($status, $body);
        }

        if (in_array($status, [408, 429], true) || $status >= 500) {
            return OutboundResponse::transient($status);
        }

        return OutboundResponse::rejected($status);
    }

    /** Reading ->secret can throw DecryptException after an APP_KEY rotation. */
    private function secretFor(Integration $integration): ?string
    {
        return $integration->secret;
    }
}
