<?php

use App\Models\Customer;
use App\Models\PortalAccessCode;
use App\Models\PortalSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 200 with a token and creates one session for the right code', function () {
    $customer = Customer::factory()->create(['email' => 'right@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->create(['identifier' => 'right@example.com']);

    $res = $this->postJson('/api/portal/access/verify', [
        'identifier' => 'right@example.com',
        'code' => '123456',
    ])->assertOk();

    expect($res->json('token'))->toBeString()->not->toBeEmpty();
    expect(PortalSession::where('customer_id', $customer->id)->count())->toBe(1);
});

it('returns 422 with a decreasing attempts_remaining for the wrong code', function () {
    $customer = Customer::factory()->create(['email' => 'wrong@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->create(['identifier' => 'wrong@example.com']);

    $first = $this->postJson('/api/portal/access/verify', ['identifier' => 'wrong@example.com', 'code' => '000000'])
        ->assertStatus(422);
    $second = $this->postJson('/api/portal/access/verify', ['identifier' => 'wrong@example.com', 'code' => '000000'])
        ->assertStatus(422);

    expect($first->json('attempts_remaining'))->toBeGreaterThan($second->json('attempts_remaining'));
});

it('returns 410 on the sixth attempt and every attempt after', function () {
    $customer = Customer::factory()->create(['email' => 'exhaust@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->create(['identifier' => 'exhaust@example.com']);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/portal/access/verify', ['identifier' => 'exhaust@example.com', 'code' => '000000'])
            ->assertStatus(422);
    }

    $this->postJson('/api/portal/access/verify', ['identifier' => 'exhaust@example.com', 'code' => '000000'])
        ->assertStatus(410);

    $this->postJson('/api/portal/access/verify', ['identifier' => 'exhaust@example.com', 'code' => '123456'])
        ->assertStatus(410);
});

it('returns 410 for an expired code', function () {
    $customer = Customer::factory()->create(['email' => 'expired@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->expired()
        ->create(['identifier' => 'expired@example.com']);

    $this->postJson('/api/portal/access/verify', ['identifier' => 'expired@example.com', 'code' => '123456'])
        ->assertStatus(410);
});

it('returns 410 for a consumed code', function () {
    $customer = Customer::factory()->create(['email' => 'consumed@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->consumed()
        ->create(['identifier' => 'consumed@example.com']);

    $this->postJson('/api/portal/access/verify', ['identifier' => 'consumed@example.com', 'code' => '123456'])
        ->assertStatus(410);
});

it('yields exactly one session when the same code is verified twice concurrently', function () {
    $customer = Customer::factory()->create(['email' => 'race@example.com']);
    PortalAccessCode::factory()->for($customer)->withCode('123456')->create(['identifier' => 'race@example.com']);

    $access = app(\App\Services\PortalAccess::class);

    $first = $access->verify('race@example.com', '123456', 'agent-a');
    expect($first)->not->toBeNull();

    // The second verify against the same (now-consumed) row must reject.
    expect(fn () => $access->verify('race@example.com', '123456', 'agent-b'))
        ->toThrow(\App\Exceptions\PortalCodeUnusableException::class);

    expect(PortalSession::count())->toBe(1);
});
