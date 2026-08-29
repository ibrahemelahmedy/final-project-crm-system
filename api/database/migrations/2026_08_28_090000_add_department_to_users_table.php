<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 08 owns this column. The Story 01 users migration
 * (0001_01_01_000000_create_users_table.php) is never edited.
 *
 * `department` is nullable and backfilled empty — existing users render "—"
 * in the DEPARTMENT column until an Administrator sets one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('department')->nullable()->after('role');
            // The Users list filters and counts by role on every page load.
            $table->index('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['role']);
            $table->dropColumn('department');
        });
    }
};
