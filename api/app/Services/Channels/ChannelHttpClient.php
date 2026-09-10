<?php

namespace App\Services\Channels;

use App\Services\Integrations\OutboundResponse;
use App\Services\Integrations\OutboundUrlGuard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 9. The ONE new class in this story that opens
 * a socket — the fourth Http:: site in api/app. Mirrors
 * App\Services\Integrations\OutboundHttpClient: validate() at send time on
 * EVERY call, allow_redirects=false, configured timeouts, and a catch that
 * logs $e::class only — never $e->getMessage(), which can embed the
 * Authorization header. This catch also covers a DecryptException from
 * reading $connection->secret.
 */
class ChannelHttpClient
{
    public function __construct(private readonly OutboundUrlGuard $guard) {}

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, string>  $headers
     */
    public function post(string $url, array $payload, array $headers = [], ?string $bearer = null, ?array $basicAuth = null, bool $asForm = false): OutboundResponse
    {
        $verdict = $this->guard->validate($url);

        if (! $verdict->ok) {
            return OutboundResponse::blocked($verdict->error);
        }

        try {
            $client = Http::withOptions(['allow_redirects' => false])
                ->timeout((int) config('channels.outbound.timeout'))
                ->connectTimeout((int) config('channels.outbound.connect_timeout'))
                ->acceptJson()
                ->withHeaders($headers);

            if ($asForm) {
                $client = $client->asForm();
            }

            if ($bearer !== null) {
                $client = $client->withToken($bearer);
            }

            if ($basicAuth !== null) {
                $client = $client->withBasicAuth($basicAuth[0], $basicAuth[1]);
            }

            $response = $client->post($url, $payload);
        } catch (Throwable $e) {
            Log::warning('Channel outbound request failed', [
                'host' => parse_url($url, PHP_URL_HOST),
                'exception' => $e::class,
            ]);

            return OutboundResponse::transportFailure();
        }

        return $this->classify($response->status(), $response->body());
    }

    /** @param array<string, string> $headers */
    public function get(string $url, array $headers = [], ?string $bearer = null, ?array $basicAuth = null): OutboundResponse
    {
        $verdict = $this->guard->validate($url);

        if (! $verdict->ok) {
            return OutboundResponse::blocked($verdict->error);
        }

        try {
            $client = Http::withOptions(['allow_redirects' => false])
                ->timeout((int) config('channels.outbound.timeout'))
                ->connectTimeout((int) config('channels.outbound.connect_timeout'))
                ->acceptJson()
                ->withHeaders($headers);

            if ($bearer !== null) {
                $client = $client->withToken($bearer);
            }

            if ($basicAuth !== null) {
                $client = $client->withBasicAuth($basicAuth[0], $basicAuth[1]);
            }

            $response = $client->get($url);
        } catch (Throwable $e) {
            Log::warning('Channel outbound request failed', [
                'host' => parse_url($url, PHP_URL_HOST),
                'exception' => $e::class,
            ]);

            return OutboundResponse::transportFailure();
        }

        return $this->classify($response->status(), $response->body());
    }

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
}
