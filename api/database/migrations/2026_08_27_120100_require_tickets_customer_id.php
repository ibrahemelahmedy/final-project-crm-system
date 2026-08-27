<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The only rows that can lack a customer are the four demo tickets the
     * Story 01 seeder created before this column existed. Story 04's seeder
     * recreates them with customers. Deleting them here is what lets the
     * NOT NULL constraint go on cleanly in an environment that has already
     * been migrated once.
     */
    public function up(): void
    {
        DB::table('tickets')->whereNull('customer_id')->delete();

        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->change();
        });
    }
};
