<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\ChatSession;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

/** Story 26 (WIS-22), Test Plan §F — Done Criterion 6's error path. */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

it('an unsigned POST returns 401 with exactly one message key', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $response = $this->postJson('/api/webhooks/channels/email_webhook', ['message_id' => 'x']);

    $response->assertStatus(401);
    expect(array_keys($response->json()))->toBe(['message']);
});

it('a wrongly-signed POST returns 401 and writes nothing to any of the four new tables', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $body = json_encode(['message_id' => 'x', 'from' => ['email' => 'a@example.com'], 'subject' => 's', 'text' => 't']);

    $response = test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WISAL_SIGNATURE' => 'sha256=wrong',
    ], $body);

    $response->assertStatus(401);
    expect(ChannelInboundMessage::count())->toBe(0);
    expect(ChannelOutboundMessage::count())->toBe(0);
    expect(Ticket::count())->toBe(0);
    expect(ChatSession::count())->toBe(0);
});

it('a POST for a channel with no connection row returns the same 401', function () {
    $response = $this->postJson('/api/webhooks/channels/email_webhook', ['message_id' => 'x']);

    $response->assertStatus(401);
    expect($response->json('message'))->toBe(__('channels.webhook_rejected'));
});

it('a POST for a connection in error status returns the same 401', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $connection->forceFill(['status' => 'error'])->save();

    $body = json_encode(['message_id' => 'x']);
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    $response = test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WISAL_SIGNATURE' => $signature,
    ], $body);

    $response->assertStatus(401);
});

it('a body over max_body_bytes returns 413 before the HMAC is computed', function () {
    config(['channels.inbound.max_body_bytes' => 100]);
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $body = json_encode(['message_id' => 'x', 'text' => str_repeat('a', 500)]);

    $response = test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
    ], $body);

    $response->assertStatus(413);
});

it('an unknown {provider} returns 404', function () {
    $this->postJson('/api/webhooks/channels/not_a_real_provider', [])->assertStatus(404);
    $this->getJson('/api/webhooks/channels/not_a_real_provider')->assertStatus(404);
});

it('a verified-but-garbage JSON body returns 202 received:0, not a 4xx', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $body = 'not valid json at all {{{';
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    $response = test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WISAL_SIGNATURE' => $signature,
    ], $body);

    $response->assertStatus(202)->assertJson(['received' => 0]);
});

it('no webhook route carries auth:sanctum or portal, and every one carries throttle:channel-webhook', function () {
    $checked = 0;

    foreach (Route::getRoutes() as $route) {
        if (! str_starts_with($route->uri(), 'api/webhooks/')) {
            continue;
        }

        $middleware = $route->gatherMiddleware();
        expect($middleware)->not->toContain('auth:sanctum');
        expect($middleware)->not->toContain('portal');
        expect($middleware)->toContain('throttle:channel-webhook');
        $checked++;
    }

    expect($checked)->toBeGreaterThan(0);
});
