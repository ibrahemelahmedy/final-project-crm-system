<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 15 (WIS-11) owns this column. Story 01 owns the `users` table and is
 * never edited; Story 08 added `department` the same way.
 *
 * `locale` has a default of 'en', so existing rows need no backfill. Allowed
 * values are 'en' and 'ar' — enforced by UpdatePreferencesRequest, not a DB
 * CHECK (SQLite path B does not carry one portably).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('locale', 5)->default('en')->after('department');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('locale');
        });
    }
};
