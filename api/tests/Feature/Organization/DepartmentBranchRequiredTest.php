<?php

use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('rejects creating a department with 422 when branches is empty', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'name' => 'Technical Support',
    ])->assertStatus(422);

    expect(Department::count())->toBe(0);
});

it('rejects a branch_id that does not exist', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'branch_id' => 999999,
        'name' => 'Technical Support',
    ])->assertStatus(422);
});

it('allows the same department name in two different branches', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branchA = Branch::factory()->create();
    $branchB = Branch::factory()->create();

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'branch_id' => $branchA->id,
        'name' => 'Billing',
    ])->assertCreated();

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'branch_id' => $branchB->id,
        'name' => 'Billing',
    ])->assertCreated();
});

it('rejects the same department name twice in one branch', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create();
    Department::factory()->create(['branch_id' => $branch->id, 'name' => 'Billing']);

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'branch_id' => $branch->id,
        'name' => 'Billing',
    ])->assertStatus(422);
});
