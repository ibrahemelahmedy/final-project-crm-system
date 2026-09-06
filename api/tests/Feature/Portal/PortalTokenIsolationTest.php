<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('rejects a portal token on a staff route', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('portal-only-token')->create();

    $this->asToken('portal-only-token')->getJson('/api/tickets')->assertStatus(401);
});

it('rejects a staff Sanctum token on a portal route', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->asUser($agent)->getJson('/api/portal/requests')->assertStatus(401);
});

it('creates no personal_access_tokens row from a portal verify', function () {
    $customer = Customer::factory()->create(['email' => 'isolated@example.com']);
    \App\Models\PortalAccessCode::factory()->for($customer)->withCode('123456')
        ->create(['identifier' => 'isolated@example.com']);

    $before = DB::table('personal_access_tokens')->count();

    $this->postJson('/api/portal/access/verify', ['identifier' => 'isolated@example.com', 'code' => '123456'])
        ->assertOk();

    expect(DB::table('personal_access_tokens')->count())->toBe($before);
});

it('touches zero users rows across the whole access flow', function () {
    $customer = Customer::factory()->create(['email' => 'nousers@example.com']);

    $usersCountBefore = DB::table('users')->count();

    $this->postJson('/api/portal/access/request', ['identifier' => 'nousers@example.com'])->assertStatus(202);

    $code = \App\Models\PortalAccessCode::where('customer_id', $customer->id)->firstOrFail();
    // The plaintext is never stored — recover it the only way a test can:
    // by regenerating a row with a known code and verifying against that.
    $code->update(['code_hash' => \Illuminate\Support\Facades\Hash::make('654321')]);

    $this->postJson('/api/portal/access/verify', ['identifier' => 'nousers@example.com', 'code' => '654321'])
        ->assertOk();

    expect(DB::table('users')->count())->toBe($usersCountBefore);
});
