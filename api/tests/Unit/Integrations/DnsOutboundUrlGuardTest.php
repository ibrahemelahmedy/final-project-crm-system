<?php

use App\Services\Integrations\DnsOutboundUrlGuard;

beforeEach(function () {
    $this->guard = new DnsOutboundUrlGuard;
});

it('rejects a plain http:// url', function () {
    $verdict = $this->guard->validate('http://example.com');

    expect($verdict->ok)->toBeFalse();
    expect($verdict->error)->toBe('integrations.error.scheme');
});

it('rejects localhost', function () {
    $verdict = $this->guard->validate('https://localhost/x');

    expect($verdict->ok)->toBeFalse();
    expect($verdict->error)->toBe('integrations.error.blocked_host');
});

it('rejects a loopback IPv4 host', function () {
    $verdict = $this->guard->validate('https://127.0.0.1/x');

    expect($verdict->ok)->toBeFalse();
    expect($verdict->error)->toBe('integrations.error.blocked_host');
});

it('rejects a private IPv4 host', function () {
    $verdict = $this->guard->validate('https://192.168.1.10/x');

    expect($verdict->ok)->toBeFalse();
    expect($verdict->error)->toBe('integrations.error.blocked_host');
});

it('rejects the IPv6 loopback host', function () {
    $verdict = $this->guard->validate('https://[::1]/x');

    expect($verdict->ok)->toBeFalse();
});

it('passes a resolvable public host', function () {
    $verdict = $this->guard->validate('https://example.com/x');

    expect($verdict->ok)->toBeTrue();
    expect($verdict->ip)->not->toBeNull();
});

it('rejects an unresolvable host', function () {
    $verdict = $this->guard->validate('https://this-host-does-not-exist.invalid.test/x');

    expect($verdict->ok)->toBeFalse();
    expect($verdict->error)->toBe('integrations.error.unreachable');
});
