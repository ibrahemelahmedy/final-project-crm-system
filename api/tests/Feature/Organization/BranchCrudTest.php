<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a branch and returns 201 with an audit row', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $response = $this->asUser($admin)->postJson('/api/admin/branches', [
        'name' => 'Downtown HQ',
        'region' => 'Riyadh, SA',
        'timezone' => 'Asia/Riyadh',
        'is_active' => true,
    ])->assertCreated();

    $response->assertJsonPath('data.name', 'Downtown HQ')
        ->assertJsonPath('data.region', 'Riyadh, SA')
        ->assertJsonPath('data.agent_count', 0);

    $this->assertDatabaseHas('branches', ['name' => 'Downtown HQ']);
    expect(AuditLog::where('event', 'branch.changed')->count())->toBe(1);
});

it('lists branches with a correct agent_count', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create();
    User::factory()->count(2)->create(['branch_id' => $branch->id]);

    $this->asUser($admin)->getJson('/api/admin/branches')
        ->assertOk()
        ->assertJsonPath('data.0.agent_count', 2);
});

it('patches the region and returns 200 with an audit row', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['region' => 'Old Region']);

    $this->asUser($admin)->patchJson("/api/admin/branches/{$branch->id}", [
        'name' => $branch->name,
        'region' => 'New Region',
        'timezone' => $branch->timezone,
    ])->assertOk()
        ->assertJsonPath('data.region', 'New Region');

    expect(AuditLog::where('event', 'branch.changed')->count())->toBe(1);
});

it('deactivates a branch via is_active=false', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['is_active' => true]);

    $this->asUser($admin)->patchJson("/api/admin/branches/{$branch->id}", [
        'name' => $branch->name,
        'timezone' => $branch->timezone,
        'is_active' => false,
    ])->assertOk()
        ->assertJsonPath('data.is_active', false);

    $this->assertDatabaseHas('branches', ['id' => $branch->id, 'is_active' => false]);
});

it('writes no audit row when re-saving identical values', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['name' => 'Same', 'region' => 'Same Region', 'timezone' => 'UTC', 'is_active' => true]);

    $this->asUser($admin)->patchJson("/api/admin/branches/{$branch->id}", [
        'name' => 'Same',
        'region' => 'Same Region',
        'timezone' => 'UTC',
        'is_active' => true,
    ])->assertOk();

    expect(AuditLog::where('event', 'branch.changed')->count())->toBe(0);
});
