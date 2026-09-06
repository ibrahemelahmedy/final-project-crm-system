<?php

use App\Services\HttpIntegrationTester;
use Illuminate\Support\Facades\Http;

// Deliberately calls the REAL HttpIntegrationTester directly rather than
// through the HTTP endpoint — TestIntegrationRequest's `url:https` rule
// already rejects a non-https scheme at the FormRequest layer (422), so
// hitting the endpoint would never exercise the tester's own guard. Every
// case below must be rejected by the scheme or SSRF guard before a socket
// opens, so Http::fake() records zero requests for all of them regardless of
// entry point.
beforeEach(function () {
    Http::fake();
    $this->tester = app(HttpIntegrationTester::class);
});

it('rejects a plain http:// endpoint before opening a socket', function () {
    $result = $this->tester->test('http://example.com', null);

    expect($result['ok'])->toBeFalse();
    expect($result['error'])->toBe('integrations.error.scheme');
    Http::assertNothingSent();
});

it('rejects localhost before opening a socket', function () {
    $result = $this->tester->test('https://localhost/x', null);

    expect($result['ok'])->toBeFalse();
    expect($result['error'])->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('rejects a loopback IPv4 host before opening a socket', function () {
    $result = $this->tester->test('https://127.0.0.1/x', null);

    expect($result['ok'])->toBeFalse();
    expect($result['error'])->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('rejects a private IPv4 host before opening a socket', function () {
    $result = $this->tester->test('https://192.168.1.10/x', null);

    expect($result['ok'])->toBeFalse();
    expect($result['error'])->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('rejects the IPv6 loopback host before opening a socket', function () {
    $result = $this->tester->test('https://[::1]/x', null);

    expect($result['ok'])->toBeFalse();
    Http::assertNothingSent();
});
