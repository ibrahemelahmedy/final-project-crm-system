<?php

use App\Enums\SyncRunTrigger;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Services\Integrations\CustomerPuller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;

// Deliberately binds NO OutboundUrlGuard fake — every case here must be
// rejected by the real DnsOutboundUrlGuard before a socket opens.
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
});

it('rejects a private IPv4 inbound URL — Http::assertNothingSent, run failed, blocked_host', function () {
    Http::fake();
    $integration = Integration::factory()->inbound()->create(['inbound_url' => 'https://192.168.10.10/customers']);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('failed');
    expect($run->error_key)->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('rejects a loopback IPv4 inbound URL', function () {
    Http::fake();
    $integration = Integration::factory()->inbound()->create(['inbound_url' => 'https://127.0.0.1/customers']);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('failed');
    expect($run->error_key)->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('rejects the dotless host localhost', function () {
    Http::fake();
    $integration = Integration::factory()->inbound()->create(['inbound_url' => 'https://localhost/customers']);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('failed');
    expect($run->error_key)->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('a private outbound_url dead-letters the message with blocked_host and sends nothing', function () {
    Http::fake();
    $integration = Integration::factory()->outbound()->create(['outbound_url' => 'https://10.1.2.3/hook']);
    IntegrationOutboxMessage::factory()->for($integration)->create();

    Artisan::call('sync:flush-outbox');

    $message = IntegrationOutboxMessage::first();
    expect($message->status->value)->toBe('dead');
    expect($message->last_error_key)->toBe('integrations.error.blocked_host');
    Http::assertNothingSent();
});

it('re-validates at send time: a row edited to a private IP after one successful delivery sends nothing on the next attempt', function () {
    Http::fake(['example.com/*' => Http::response(['ok' => true], 200)]);
    $integration = Integration::factory()->outbound()->create();

    $first = IntegrationOutboxMessage::factory()->for($integration)->create();
    Artisan::call('sync:flush-outbox');
    expect($first->fresh()->status->value)->toBe('delivered');

    // The attack: bypass the FormRequest entirely with a direct model write.
    $integration->forceFill(['outbound_url' => 'https://192.168.1.5/hook'])->save();

    $second = IntegrationOutboxMessage::factory()->for($integration)->create();
    Http::fake(); // reset recorder for the assertion below
    Artisan::call('sync:flush-outbox');

    expect($second->fresh()->status->value)->toBe('dead');
    Http::assertNothingSent();
});

it('pagination never leaves our base URL even when the payload points at a metadata endpoint', function () {
    bindOutboundUrlGuard(true);
    $integration = Integration::factory()->inbound()->create();

    Http::fakeSequence()
        ->push(['data' => [], 'links' => ['next' => 'http://169.254.169.254/latest/meta-data']])
        ->whenEmpty(Http::response([]));

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    foreach (Http::recorded() as [$request, $response]) {
        expect($request->url())->toContain('example.com');
        expect($request->url())->not->toContain('169.254.169.254');
    }
});
