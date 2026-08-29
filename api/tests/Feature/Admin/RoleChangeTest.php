<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'name' => 'System Admin',
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->agent = User::factory()->create([
        'name' => 'James Rodriguez',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $this->adminToken = $this->admin->createToken('spa')->plainTextToken;
});

it('grants the new roles access on the very next request with the SAME token', function () {
    $agentToken = $this->agent->createToken('spa')->plainTextToken;

    // The Agent cannot reach the team dashboard before the promotion.
    $this->asToken($agentToken)
        ->getJson('/api/dashboard/team/summary')
        ->assertStatus(403);

    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$this->agent->id}", ['role' => UserRole::TeamLead->value])
        ->assertOk()
        ->assertJsonPath('data.role', 'team_lead');

    // Same token, next request — no re-login.
    $this->asToken($agentToken)
        ->getJson('/api/dashboard/team/summary')
        ->assertOk();
});

it('removes the old roles access on the very next request — no stale elevated permission', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $leadToken = $lead->createToken('spa')->plainTextToken;

    $this->asToken($leadToken)
        ->getJson('/api/dashboard/team/summary')
        ->assertOk();

    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$lead->id}", ['role' => UserRole::Agent->value])
        ->assertOk();

    $this->asToken($leadToken)
        ->getJson('/api/dashboard/team/summary')
        ->assertStatus(403);
});

it('does NOT revoke tokens on a role change — the user stays signed in', function () {
    $agentToken = $this->agent->createToken('spa')->plainTextToken;

    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$this->agent->id}", ['role' => UserRole::TeamLead->value])
        ->assertOk();

    expect(DB::table('personal_access_tokens')->where('tokenable_id', $this->agent->id)->count())->toBe(1);

    $this->asToken($agentToken)
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('data.role', 'team_lead');
});

it('writes a user.role_changed row carrying both the from and to role', function () {
    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$this->agent->id}", ['role' => UserRole::Administrator->value])
        ->assertOk();

    $row = AuditLog::where('event', AuditTrail::USER_ROLE_CHANGED)->sole();

    expect($row->user_id)->toBe($this->admin->id);
    expect($row->context['target_id'])->toBe($this->agent->id);
    expect($row->context['target_label'])->toBe('James Rodriguez');
    expect($row->context['from'])->toBe('agent');
    expect($row->context['to'])->toBe('administrator');
});

it('writes no user.role_changed row when the edit does not touch the role', function () {
    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$this->agent->id}", ['name' => 'Renamed Only'])
        ->assertOk();

    expect(AuditLog::where('event', AuditTrail::USER_ROLE_CHANGED)->count())->toBe(0);
    expect(AuditLog::where('event', AuditTrail::USER_UPDATED)->count())->toBe(1);
});

it('writes no user.role_changed row when the role is submitted unchanged', function () {
    $this->asToken($this->adminToken)
        ->patchJson("/api/admin/users/{$this->agent->id}", ['role' => UserRole::Agent->value])
        ->assertOk();

    expect(AuditLog::where('event', AuditTrail::USER_ROLE_CHANGED)->count())->toBe(0);
});
