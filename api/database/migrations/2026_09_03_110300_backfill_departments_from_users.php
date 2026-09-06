<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Story 20 (WIS-20). Maps the existing free-text `users.department` values
 * onto real `branches` / `departments` rows, without ever clearing the
 * string column (Decision 3 in the story plan).
 *
 * On a FRESH database `migrate:fresh --seed` runs migrations before
 * seeders, so this sees zero users and correctly no-ops rather than
 * creating a phantom "Main Branch" — DatabaseSeeder owns fresh-install
 * branch/department data instead.
 *
 * down() deletes ONLY the rows this migration created (matched by the Main
 * Branch id it captures), never a truncate — a rollback after an
 * administrator has added real branches must not destroy them.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            $names = DB::table('users')
                ->whereNotNull('department')
                ->where('department', '!=', '')
                ->distinct()
                ->pluck('department');

            if ($names->isEmpty()) {
                return;
            }

            $branchId = DB::table('branches')->insertGetId([
                'name' => 'Main Branch',
                'region' => null,
                'timezone' => 'UTC',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($names as $name) {
                $departmentId = DB::table('departments')->insertGetId([
                    'branch_id' => $branchId,
                    'name' => $name,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('users')
                    ->where('department', $name)
                    ->update(['branch_id' => $branchId, 'department_id' => $departmentId]);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            $branch = DB::table('branches')->where('name', 'Main Branch')->first();

            if ($branch === null) {
                return;
            }

            DB::table('users')
                ->where('branch_id', $branch->id)
                ->update(['branch_id' => null, 'department_id' => null]);

            DB::table('departments')->where('branch_id', $branch->id)->delete();
            DB::table('branches')->where('id', $branch->id)->delete();
        });
    }
};
