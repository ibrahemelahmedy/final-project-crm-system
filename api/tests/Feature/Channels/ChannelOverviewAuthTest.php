<?php

use App\Enums\UserRole;
use App\Models\ChannelConnection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('rejects an unauthenticated request with 401', function () {
    $this->getJson('/api/channels/overview')->assertUnauthorized();
});

/**
 * Story 26 (WIS-22), Decision 12. Rewritten from "every channel is always
 * not_connected" — the honest default is still the default with no rows.
 */
it('grants every role 200 with not_connected for all channels when no connection exists', function () {
    foreach ([UserRole::Agent, UserRole::TeamLead, UserRole::Administrator] as $role) {
        $user = User::factory()->create(['role' => $role, 'is_active' => true]);

        $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

        expect($res->json('data'))->toHaveCount(5);
        foreach ($res->json('data') as $channel) {
            expect($channel['status'])->toBe('not_connected');
            expect($channel['connection'])->toBeNull();
        }
    }
});

it('reports connected for exactly the channel with a row, and leaves the other four alone', function () {
    ChannelConnection::factory()->whatsapp()->create();

    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

    foreach ($res->json('data') as $channel) {
        if ($channel['value'] === 'whatsapp') {
            expect($channel['status'])->toBe('connected');
            expect($channel['connection'])->not->toBeNull();
            expect($channel['connection'])->toHaveKeys(['provider', 'last_inbound_at', 'inbound_24h', 'last_error_key', 'connectable']);
        } else {
            expect($channel['status'])->toBe('not_connected');
            expect($channel['connection'])->toBeNull();
        }
    }
});

/**
 * Story 26 (WIS-22), Decision 12. Rewritten from `toHaveCount(1)` — this
 * story legitimately adds routes whose URI contains "channels"
 * (api/admin/channels/{channel}, api/webhooks/channels/{provider}). The
 * REPLACEMENT guarantee is stronger: it survives a sixth route instead of
 * forbidding one. Every "channels" route is either a signature-authenticated
 * webhook, carries auth:sanctum (the overview), or carries administrator
 * (the config routes) — and no write verb exists outside the
 * administrator-gated group.
 */
it('exposes no unguarded channel configuration route', function () {
    $channelRoutes = collect(Route::getRoutes())->filter(
        fn ($r) => str_contains($r->uri(), 'channels')
    );

    $getChannelsRoutes = $channelRoutes->filter(
        fn ($r) => in_array('GET', $r->methods(), true) && str_starts_with($r->uri(), 'api/channels/')
    );

    // The only GET /api/channels/* route is still the overview.
    expect($getChannelsRoutes->pluck('uri')->unique()->values()->all())->toBe(['api/channels/overview']);

    foreach ($channelRoutes as $route) {
        $middleware = $route->gatherMiddleware();
        $isWebhook = str_starts_with($route->uri(), 'api/webhooks/');
        $writesConfig = array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']) !== []
            && ! str_starts_with($route->uri(), 'api/webhooks/');

        expect(
            $isWebhook || in_array('auth:sanctum', $middleware, true) || in_array('administrator', $middleware, true)
        )->toBeTrue("Route {$route->uri()} carries none of webhook/auth:sanctum/administrator.");

        if ($writesConfig) {
            expect($middleware)->toContain('administrator');
        }
    }
});
