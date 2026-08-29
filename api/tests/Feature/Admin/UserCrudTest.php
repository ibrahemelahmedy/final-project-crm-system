<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'name' => 'System Admin',
        'email' => 'admin@wisal.test',
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->token = $this->admin->createToken('spa')->plainTextToken;

    // withHeader persists into defaultHeaders, so every request in the test
    // that follows is authenticated as the Administrator.
    $this->asToken($this->token);
});

it('creates an internal user with exactly one role', function () {
    $response = $this->postJson('/api/admin/users', [
        'name' => 'Lena Torres',
        'email' => 'lena.torres@wisal.io',
        'role' => UserRole::Agent->value,
        'department' => 'Billing Support',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.email', 'lena.torres@wisal.io')
        ->assertJsonPath('data.role', 'agent')
        ->assertJsonPath('data.role_label', 'Agent')
        ->assertJsonPath('data.department', 'Billing Support')
        ->assertJsonPath('data.is_active', true);

    expect(User::where('email', 'lena.torres@wisal.io')->exists())->toBeTrue();
});

it('rejects a create with no role — a user is never role-less', function () {
    $response = $this->postJson('/api/admin/users', [
        'name' => 'No Role',
        'email' => 'norole@wisal.io',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('role');

    // The users table has default('agent'); prove the default did NOT silently
    // supply a role behind the validation error.
    expect(User::where('email', 'norole@wisal.io')->exists())->toBeFalse();
});

it('rejects a role value outside the three UserRole cases', function () {
    $response = $this->postJson('/api/admin/users', [
        'name' => 'Bad Role',
        'email' => 'badrole@wisal.io',
        'role' => 'superuser',
    ]);

    $response->assertStatus(422)->assertJsonValidationErrors('role');
    expect(User::where('email', 'badrole@wisal.io')->exists())->toBeFalse();
});

it('returns 422 — not 500 — for a duplicate email on invite', function () {
    User::factory()->create(['email' => 'taken@wisal.io']);

    $response = $this->postJson('/api/admin/users', [
        'name' => 'Duplicate',
        'email' => 'taken@wisal.io',
        'role' => UserRole::Agent->value,
    ]);

    $response->assertStatus(422)->assertJsonValidationErrors('email');
});

it('lowercases and trims the email on create', function () {
    $this->postJson('/api/admin/users', [
        'name' => 'Mixed Case',
        'email' => '  MiXeD@Wisal.IO  ',
        'role' => UserRole::TeamLead->value,
    ])->assertCreated();

    expect(User::where('email', 'mixed@wisal.io')->exists())->toBeTrue();
});

it('updates name, email, role, and department', function () {
    $user = User::factory()->create([
        'name' => 'Before',
        'email' => 'before@wisal.io',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $this->patchJson("/api/admin/users/{$user->id}", [
        'name' => 'After',
        'email' => 'after@wisal.io',
        'role' => UserRole::TeamLead->value,
        'department' => 'Platform',
    ])->assertOk()
        ->assertJsonPath('data.name', 'After')
        ->assertJsonPath('data.role', 'team_lead')
        ->assertJsonPath('data.department', 'Platform');
});

it('lets an edit clear the nullable department', function () {
    $user = User::factory()->create(['department' => 'Platform', 'role' => UserRole::Agent, 'is_active' => true]);

    $this->patchJson("/api/admin/users/{$user->id}", ['department' => null])
        ->assertOk()
        ->assertJsonPath('data.department', null);
});

it('rejects an edit that would clear the role', function () {
    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->patchJson("/api/admin/users/{$user->id}", ['role' => null])
        ->assertStatus(422)
        ->assertJsonValidationErrors('role');
});

it('rejects an edit that takes another users email', function () {
    User::factory()->create(['email' => 'other@wisal.io']);
    $user = User::factory()->create(['email' => 'mine@wisal.io', 'role' => UserRole::Agent, 'is_active' => true]);

    $this->patchJson("/api/admin/users/{$user->id}", ['email' => 'other@wisal.io'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('allows an edit that keeps the users own email', function () {
    $user = User::factory()->create(['email' => 'mine@wisal.io', 'role' => UserRole::Agent, 'is_active' => true]);

    $this->patchJson("/api/admin/users/{$user->id}", [
        'email' => 'mine@wisal.io',
        'name' => 'Renamed',
    ])->assertOk()->assertJsonPath('data.name', 'Renamed');
});

it('never exposes a DELETE route for a user', function () {
    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->deleteJson("/api/admin/users/{$user->id}")->assertStatus(405);

    expect(User::whereKey($user->id)->exists())->toBeTrue();
});

it('pages and filters the users list server-side, defaulting to active only', function () {
    User::factory()->count(30)->create(['role' => UserRole::Agent, 'is_active' => true]);
    User::factory()->create(['name' => 'Deactivated Person', 'role' => UserRole::Agent, 'is_active' => false]);

    $default = $this->getJson('/api/admin/users?per_page=10');

    $default->assertOk()
        ->assertJsonCount(10, 'data')
        // 30 agents + the admin from beforeEach; the inactive user is excluded.
        ->assertJsonPath('meta.total', 31)
        ->assertJsonPath('meta.per_page', 10);

    $this->getJson('/api/admin/users?status=inactive')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Deactivated Person');

    $this->getJson('/api/admin/users?status=all')
        ->assertOk()
        ->assertJsonPath('meta.total', 32);

    $this->getJson('/api/admin/users?role[]=administrator')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.email', 'admin@wisal.test');
});

it('searches the users list by name and email', function () {
    User::factory()->create(['name' => 'Kenji Matsuda', 'email' => 'kenji.m@wisal.io', 'role' => UserRole::Agent, 'is_active' => true]);
    User::factory()->create(['name' => 'Riya Patel', 'email' => 'riya.patel@wisal.io', 'role' => UserRole::Agent, 'is_active' => true]);

    $this->getJson('/api/admin/users?q=Kenji')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Kenji Matsuda');

    $this->getJson('/api/admin/users?q=riya.patel')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Riya Patel');
});

it('rejects a sort column outside the whitelist', function () {
    $this->getJson('/api/admin/users?sort=password')
        ->assertStatus(422)
        ->assertJsonValidationErrors('sort');
});

it('counts only distinct NON-NULL departments in the facets', function () {
    User::factory()->create(['department' => 'Platform', 'role' => UserRole::Agent, 'is_active' => true]);
    User::factory()->create(['department' => 'Platform', 'role' => UserRole::Agent, 'is_active' => true]);
    User::factory()->create(['department' => 'Billing Support', 'role' => UserRole::Agent, 'is_active' => true]);
    User::factory()->create(['department' => null, 'role' => UserRole::Agent, 'is_active' => true]);

    $response = $this->getJson('/api/admin/users/facets');

    $response->assertOk()
        ->assertJsonPath('department_total', 2)
        ->assertJsonCount(3, 'roles');

    expect(collect($response->json('departments'))->pluck('value')->all())
        ->toBe(['Billing Support', 'Platform']);
});
