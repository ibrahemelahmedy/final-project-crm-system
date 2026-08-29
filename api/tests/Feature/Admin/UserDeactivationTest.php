<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'name' => 'System Admin',
        'email' => 'admin@wisal.test',
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->agent = User::factory()->create([
        'name' => 'Tom Becker',
        'email' => 'tom.becker@wisal.io',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $this->adminToken = $this->admin->createToken('spa')->plainTextToken;
    $this->asToken($this->adminToken);
});

it('deletes EVERY personal access token for the deactivated user, in the same transaction', function () {
    // Three sessions — a phone, a laptop, a second browser.
    $this->agent->createToken('spa')->plainTextToken;
    $this->agent->createToken('spa')->plainTextToken;
    $this->agent->createToken('spa')->plainTextToken;

    expect(DB::table('personal_access_tokens')->where('tokenable_id', $this->agent->id)->count())->toBe(3);

    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    expect(DB::table('personal_access_tokens')->where('tokenable_id', $this->agent->id)->count())->toBe(0);
    // The Administrator's own token is untouched.
    expect(DB::table('personal_access_tokens')->where('tokenable_id', $this->admin->id)->count())->toBe(1);
});

it('returns 401 on the NEXT request with a previously valid token, not merely at next login', function () {
    $agentToken = $this->agent->createToken('spa')->plainTextToken;

    // Prove the token works before the deactivation.
    $this->asToken($agentToken)
        ->getJson('/api/user')
        ->assertOk();

    $this->asToken($this->adminToken)
        ->postJson("/api/admin/users/{$this->agent->id}/deactivate")
        ->assertOk();

    $this->asToken($agentToken)
        ->getJson('/api/user')
        ->assertStatus(401);
});

it('401s a deactivated user whose token somehow survived — the ActiveUserOnly layer', function () {
    // Simulates the cookie-mode / race case the token delete alone does not
    // cover: the flag is false but a token still exists.
    $agentToken = $this->agent->createToken('spa')->plainTextToken;
    $this->agent->forceFill(['is_active' => false])->save();

    $this->asToken($agentToken)
        ->getJson('/api/user')
        ->assertStatus(401)
        ->assertJsonPath('message', 'This account has been deactivated. Contact your administrator.');
});

it('keeps historical ticket and audit rows attributed to a deactivated user', function () {
    $customer = Customer::factory()->create();
    $ticket = Ticket::factory()->create([
        'subject' => 'Historical ticket',
        'customer_id' => $customer->id,
        'assigned_to' => $this->agent->id,
    ]);

    AuditLog::record('login.success', $this->agent, request());

    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")->assertOk();

    expect(User::whereKey($this->agent->id)->exists())->toBeTrue();
    expect($ticket->fresh()->assigned_to)->toBe($this->agent->id);
    expect(AuditLog::where('user_id', $this->agent->id)->where('event', 'login.success')->exists())->toBeTrue();
});

it('refuses to let an Administrator deactivate themselves', function () {
    // A second Administrator exists, so this is NOT the last-admin rule
    // firing — it is the self-deactivation rule specifically.
    User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->postJson("/api/admin/users/{$this->admin->id}/deactivate")
        ->assertStatus(422)
        ->assertJsonValidationErrors('user');

    expect($this->admin->fresh()->is_active)->toBeTrue();
});

it('refuses to downgrade the last active Administrator', function () {
    $soleAdmin = User::factory()->create(['name' => 'Sole Admin', 'role' => UserRole::Administrator, 'is_active' => true]);
    $soleToken = $soleAdmin->createToken('spa')->plainTextToken;

    // Leave exactly one active Administrator.
    $this->asToken($soleToken)
        ->postJson("/api/admin/users/{$this->admin->id}/deactivate")
        ->assertOk();

    expect(User::where('role', UserRole::Administrator->value)->where('is_active', true)->count())->toBe(1);

    $this->asToken($soleToken)
        ->patchJson("/api/admin/users/{$soleAdmin->id}", ['role' => UserRole::Agent->value])
        ->assertStatus(422)
        ->assertJsonValidationErrors('role');

    expect($soleAdmin->fresh()->role)->toBe(UserRole::Administrator);
});

it('reactivates a user without restoring their revoked tokens', function () {
    $agentToken = $this->agent->createToken('spa')->plainTextToken;

    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")->assertOk();
    $this->postJson("/api/admin/users/{$this->agent->id}/activate")
        ->assertOk()
        ->assertJsonPath('data.is_active', true);

    expect(DB::table('personal_access_tokens')->where('tokenable_id', $this->agent->id)->count())->toBe(0);

    $this->asToken($agentToken)
        ->getJson('/api/user')
        ->assertStatus(401);
});

it('writes exactly one audit row per deactivation and reactivation', function () {
    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")->assertOk();
    $this->postJson("/api/admin/users/{$this->agent->id}/activate")->assertOk();

    expect(AuditLog::where('event', AuditTrail::USER_DEACTIVATED)->count())->toBe(1);
    expect(AuditLog::where('event', AuditTrail::USER_ACTIVATED)->count())->toBe(1);

    $row = AuditLog::where('event', AuditTrail::USER_DEACTIVATED)->first();
    expect($row->user_id)->toBe($this->admin->id);
    expect($row->context['target_id'])->toBe($this->agent->id);
    expect($row->context['target_label'])->toBe('Tom Becker');
});

it('is idempotent — deactivating an already inactive user writes no second audit row', function () {
    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")->assertOk();
    $this->postJson("/api/admin/users/{$this->agent->id}/deactivate")->assertOk();

    expect(AuditLog::where('event', AuditTrail::USER_DEACTIVATED)->count())->toBe(1);
});

it('refuses to deactivate the last active Administrator at the service level', function () {
    // Not reachable over HTTP: an actor who is not the target must itself be
    // an active Administrator, which means the target is never the last one.
    // The guard still has to hold for any future caller, so it is exercised
    // against UserAdminService directly.
    $soleAdmin = User::factory()->create(['name' => 'Sole Admin', 'role' => UserRole::Administrator, 'is_active' => true]);
    $this->admin->forceFill(['is_active' => false])->save();

    expect(User::where('role', UserRole::Administrator->value)->where('is_active', true)->count())->toBe(1);

    $service = app(\App\Services\UserAdminService::class);

    expect(fn () => $service->deactivate($soleAdmin, $this->agent, request()))
        ->toThrow(\Illuminate\Validation\ValidationException::class);

    expect($soleAdmin->fresh()->is_active)->toBeTrue();
});
