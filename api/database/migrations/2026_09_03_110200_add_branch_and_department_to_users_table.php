<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 20 (WIS-20). Adds two NULLABLE foreign keys alongside Story 08's
 * `users.department` free-text column — that column is DELIBERATELY LEFT IN
 * PLACE and never edited here. `ApiContractTest.php:109` asserts
 * `data.department === 'Support Ops'` on `/api/user` for a factory user
 * created with the string column; UserResource keeps reading it unchanged
 * and this story only ADDS `branch_id` / `branch_name` / `department_id` /
 * `department_name` keys. Dropping the string column is a follow-up story
 * that also updates that contract test — not this one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('department')
                ->constrained('branches')->nullOnDelete();
            $table->foreignId('department_id')->nullable()->after('branch_id')
                ->constrained('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
            $table->dropConstrainedForeignId('branch_id');
        });
    }
};
