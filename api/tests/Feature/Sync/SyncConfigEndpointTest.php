<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Integration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
    bindOutboundUrlGuard(true);
});

function validSyncConfigBody(): array
{
    return [
        'inbound_enabled' => true,
        'inbound_url' => 'https://api.example.com/customers',
        'inbound_field_map' => ['external_id' => 'id', 'name' => 'attributes.display_name'],
        'conflict_rules' => ['name' => 'remote_wins'],
        'outbound_enabled' => true,
        'outbound_url' => 'https://api.example.com/hooks',
        'outbound_events' => ['ticket.created'],
    ];
}

it('an administrator saves a valid config and the response mirrors it', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $integration = Integration::factory()->create();

    $response = $this->asUser($admin)
        ->putJson('/api/admin/integrations/erp/sync-config', validSyncConfigBody())
        ->assertOk();

    $response->assertJsonPath('data.sync.inbound_enabled', true)
        ->assertJsonPath('data.sync.inbound_url', 'https://api.example.com/customers')
        ->assertJsonPath('data.sync.outbound_enabled', true);

    expect($integration->fresh()->inbound_field_map)->toBe(['external_id' => 'id', 'name' => 'attributes.display_name']);
});

it('writes an INTEGRATION_SYNC_CONFIG_CHANGED audit row with the URLs but not the secret or map values', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $integration = Integration::factory()->create();

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', validSyncConfigBody())->assertOk();

    $log = AuditLog::where('event', 'integration.sync_config_changed')->first();
    expect($log)->not->toBeNull();
    expect($log->context['inbound_url'])->toBe('https://api.example.com/customers');

    $json = json_encode($log->context);
    expect($json)->not->toContain($integration->secret_last_four ? 'sk_test_' : '');
    expect($json)->not->toContain('attributes.display_name');
});

it('rejects inbound_enabled true with no inbound_url as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    unset($body['inbound_url']);

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('rejects inbound_enabled true with no external_id in the map as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    $body['inbound_field_map'] = ['name' => 'attributes.display_name'];

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('rejects an http:// URL as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    $body['inbound_url'] = 'http://api.example.com/customers';

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('rejects an unknown field-map key as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    $body['inbound_field_map']['not_a_field'] = 'x.y';

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('rejects an unknown conflict rule value as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    $body['conflict_rules'] = ['name' => 'not_a_rule'];

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('rejects an unknown outbound_events entry as 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create();

    $body = validSyncConfigBody();
    $body['outbound_events'] = ['not.an.event'];

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', $body)->assertStatus(422);
});

it('returns 404 configuring a type with no integrations row', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', validSyncConfigBody())->assertStatus(404);
});

it('returns 422 not_configured when POST /sync runs on an inbound-disabled integration', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->create(['inbound_enabled' => false]);

    $this->asUser($admin)->postJson('/api/admin/integrations/erp/sync')
        ->assertStatus(422)
        ->assertJsonPath('error_key', 'integrations.sync.error.not_configured');
});

it('POST /sync runs inline and returns a finished run with trigger manual', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Integration::factory()->inbound()->create();

    Http::fakeSequence()->push([])->whenEmpty(Http::response([]));

    $response = $this->asUser($admin)->postJson('/api/admin/integrations/erp/sync')->assertOk();

    $response->assertJsonPath('data.trigger', 'manual');
});

it('denies an Agent and a Team Lead with 403, and an unauthenticated caller with 401 on all five routes', function () {
    Integration::factory()->create();
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    $routes = [
        ['PUT', '/api/admin/integrations/erp/sync-config', validSyncConfigBody()],
        ['GET', '/api/admin/integrations/erp/sync-runs', []],
        ['POST', '/api/admin/integrations/erp/sync', []],
        ['GET', '/api/admin/integrations/erp/outbox', []],
        ['POST', '/api/admin/integrations/erp/outbox/retry', []],
    ];

    foreach ($routes as [$method, $uri, $payload]) {
        expect($this->asUser($agent)->json($method, $uri, $payload)->status())->toBe(403);
        expect($this->asUser($lead)->json($method, $uri, $payload)->status())->toBe(403);
        $this->app['auth']->forgetGuards();
        expect($this->withHeaders(['Authorization' => ''])->json($method, $uri, $payload)->status())->toBe(401);
    }
});
