<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a department under a branch and returns 201 with an audit row', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['name' => 'Downtown HQ']);

    $this->asUser($admin)->postJson('/api/admin/departments', [
        'branch_id' => $branch->id,
        'name' => 'Technical Support',
        'is_active' => true,
    ])->assertCreated()
        ->assertJsonPath('data.branch_name', 'Downtown HQ')
        ->assertJsonPath('data.name', 'Technical Support');

    expect(AuditLog::where('event', 'department.changed')->count())->toBe(1);
});

it('lists departments with branch_name populated', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $branch = Branch::factory()->create(['name' => 'North Branch']);
    Department::factory()->create(['branch_id' => $branch->id, 'name' => 'Billing']);

    $this->asUser($admin)->getJson('/api/admin/departments')
        ->assertOk()
        ->assertJsonPath('data.0.branch_name', 'North Branch');
});

it('patches a department and returns 200 with an audit row', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $department = Department::factory()->create(['name' => 'Old Name']);

    $this->asUser($admin)->patchJson("/api/admin/departments/{$department->id}", [
        'branch_id' => $department->branch_id,
        'name' => 'New Name',
    ])->assertOk()
        ->assertJsonPath('data.name', 'New Name');

    expect(AuditLog::where('event', 'department.changed')->count())->toBe(1);
});

it('deactivates a department', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $department = Department::factory()->create(['is_active' => true]);

    $this->asUser($admin)->patchJson("/api/admin/departments/{$department->id}", [
        'branch_id' => $department->branch_id,
        'name' => $department->name,
        'is_active' => false,
    ])->assertOk()
        ->assertJsonPath('data.is_active', false);
});
