<?php

use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('rejects a duplicate branch name with 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    Branch::factory()->create(['name' => 'Downtown HQ']);

    $this->asUser($admin)->postJson('/api/admin/branches', [
        'name' => 'Downtown HQ',
        'timezone' => 'UTC',
    ])->assertStatus(422);
});

it('lets a PATCH re-save the same branch under its own unchanged name', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['name' => 'Downtown HQ']);

    $this->asUser($admin)->patchJson("/api/admin/branches/{$branch->id}", [
        'name' => 'Downtown HQ',
        'region' => 'Updated',
        'timezone' => $branch->timezone,
    ])->assertOk();
});

it('rejects a missing name with 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/branches', [
        'timezone' => 'UTC',
    ])->assertStatus(422);
});

it('rejects an invalid timezone with 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/branches', [
        'name' => 'Mars Branch',
        'timezone' => 'Mars/Olympus',
    ])->assertStatus(422);
});

it('accepts a null region', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/branches', [
        'name' => 'Remote Team',
        'region' => null,
        'timezone' => 'UTC',
    ])->assertCreated()
        ->assertJsonPath('data.region', null);
});
