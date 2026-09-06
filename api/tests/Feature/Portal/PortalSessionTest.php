<?php

use App\Models\Customer;
use App\Models\PortalSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 401 with no bearer token', function () {
    $this->getJson('/api/portal/me')->assertStatus(401);
});

it('returns the same 401 body for unknown, revoked, and expired tokens', function () {
    $customer = Customer::factory()->create();
    $revoked = PortalSession::factory()->for($customer)->revoked()->withToken('revoked-token')->create();
    $expired = PortalSession::factory()->for($customer)->expired()->withToken('expired-token')->create();

    $unknown = $this->asToken('unknown-token')->getJson('/api/portal/me')->assertStatus(401);
    $revokedRes = $this->asToken('revoked-token')->getJson('/api/portal/me')->assertStatus(401);
    $expiredRes = $this->asToken('expired-token')->getJson('/api/portal/me')->assertStatus(401);

    expect($unknown->json())->toBe($revokedRes->json())->toBe($expiredRes->json());
});

it('reaches /api/portal/me with a live token', function () {
    $customer = Customer::factory()->create(['name' => 'Jane Doe']);
    PortalSession::factory()->for($customer)->withToken('live-token')->create();

    $this->asToken('live-token')->getJson('/api/portal/me')
        ->assertOk()
        ->assertJsonPath('name', 'Jane Doe');
});

it('logs out with 204 and the token then 401s', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('logout-token')->create();

    $this->asToken('logout-token')->postJson('/api/portal/logout')->assertStatus(204);
    $this->asToken('logout-token')->getJson('/api/portal/me')->assertStatus(401);
});

it('advances last_used_at without touching the customer row', function () {
    $customer = Customer::factory()->create();
    $session = PortalSession::factory()->for($customer)->withToken('touch-token')->create();
    $customerUpdatedAt = $customer->updated_at;

    $this->travel(5)->minutes();
    $this->asToken('touch-token')->getJson('/api/portal/me')->assertOk();

    expect($session->fresh()->last_used_at)->not->toBeNull();
    expect($customer->fresh()->updated_at->eq($customerUpdatedAt))->toBeTrue();
});
