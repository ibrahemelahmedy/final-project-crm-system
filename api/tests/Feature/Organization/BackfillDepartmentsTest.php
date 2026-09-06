<?php

use App\Models\Branch;
use App\Models\Department;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The migration itself is data-only (no schema change), so re-invoking its
 * up() inside a test — after RefreshDatabase has already run it once as a
 * no-op on an empty database — is safe: it is just another INSERT/UPDATE
 * pass over whatever `users.department` values exist at call time.
 */
function runBackfillMigration(): object
{
    $migration = require base_path('database/migrations/2026_09_03_110300_backfill_departments_from_users.php');
    $migration->up();

    return $migration;
}

it('maps distinct department strings onto real branch/department rows without clearing the string column', function () {
    User::factory()->create(['department' => 'Support Ops']);
    User::factory()->create(['department' => 'Billing Support']);
    User::factory()->create(['department' => 'Platform']);

    runBackfillMigration();

    $branch = Branch::where('name', 'Main Branch')->first();
    expect($branch)->not->toBeNull();
    expect(Department::where('branch_id', $branch->id)->count())->toBe(3);

    foreach (['Support Ops', 'Billing Support', 'Platform'] as $name) {
        $user = User::where('department', $name)->first();
        $department = Department::where('branch_id', $branch->id)->where('name', $name)->first();

        expect($user->department)->toBe($name);
        expect($user->department_id)->toBe($department->id);
        expect($user->branch_id)->toBe($branch->id);
    }
});

it('creates no phantom branch when no user carries a department string', function () {
    User::factory()->create(['department' => null]);

    runBackfillMigration();

    expect(Branch::count())->toBe(0);
});
