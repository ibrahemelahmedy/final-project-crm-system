<?php

use App\Services\Channels\ChannelHttpClient;
use App\Services\Integrations\OutboundUrlGuard;
use App\Services\Integrations\OutboundUrlVerdict;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

/**
 * Story 26 (WIS-22), Test Plan §I. Deliberately binds NO OutboundUrlGuard
 * fake — every case here must be rejected (or accepted) by the REAL
 * DnsOutboundUrlGuard, mirroring api/tests/Feature/Sync/SyncSsrfTest.php.
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

it('a provider base URL of http:// is blocked with integrations.error.scheme and sends nothing', function () {
    Http::fake();
    $client = app(ChannelHttpClient::class);

    $response = $client->post('http://example.com/hook', []);

    expect($response->ok)->toBeFalse();
    expect($response->errorKey)->toBe('integrations.error.scheme');
    Http::assertNothingSent();
});

it('https://localhost/... and https://169.254.169.254/... are blocked with integrations.error.blocked_host', function () {
    Http::fake();
    $client = app(ChannelHttpClient::class);

    $localhost = $client->post('https://localhost/hook', []);
    expect($localhost->ok)->toBeFalse();
    expect($localhost->errorKey)->toBe('integrations.error.blocked_host');

    $metadata = $client->post('https://169.254.169.254/latest/meta-data', []);
    expect($metadata->ok)->toBeFalse();
    expect($metadata->errorKey)->toBe('integrations.error.blocked_host');

    Http::assertNothingSent();
});

it('a happy path against https://example.com/... reaches Http::fake()', function () {
    Http::fake(['example.com/*' => Http::response(['ok' => true], 200)]);
    $client = app(ChannelHttpClient::class);

    $response = $client->post('https://example.com/hook', ['a' => 1]);

    expect($response->ok)->toBeTrue();
    Http::assertSent(fn ($request) => str_contains($request->url(), 'example.com'));
});

it('ChannelHttpClient calls validate() on every call, not once per instance', function () {
    Http::fake(['example.com/*' => Http::response(['ok' => true], 200)]);

    $calls = 0;
    $realGuard = app(OutboundUrlGuard::class);

    $spy = new class($realGuard, $calls) implements OutboundUrlGuard
    {
        public int $calls = 0;

        public function __construct(private OutboundUrlGuard $inner, int $calls) {}

        public function validate(string $url): OutboundUrlVerdict
        {
            $this->calls++;

            return $this->inner->validate($url);
        }
    };
    app()->instance(OutboundUrlGuard::class, $spy);

    $client = app(ChannelHttpClient::class);
    $client->post('https://example.com/one', []);
    $client->post('https://example.com/two', []);

    expect($spy->calls)->toBe(2);
});
