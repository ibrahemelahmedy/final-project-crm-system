<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Story 25 (WIS-24). `nullOnDelete` on `integration_id`: disconnecting an
 * integration must NOT delete the customers it imported. They become
 * ordinary local customers; the partial index tolerates the resulting
 * (null, 'ext-1') rows because a null integration_id makes each pair
 * distinct under both engines' NULL semantics.
 *
 * Explicit requirement: `external_id` is NOT nulled by the FK. A customer
 * with `integration_id IS NULL` and a non-null `external_id` is a historical
 * marker only (see App\Models\Customer's docblock).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->foreignId('integration_id')->nullable()->constrained('integrations')->nullOnDelete();
            $table->string('external_id', 191)->nullable();
            $table->timestamp('external_synced_at')->nullable();
        });

        // Partial unique index — the schema builder has no API for these, and a
        // plain unique() would collide with soft-deleted rows. Same shape as
        // 2026_08_27_111743_create_customers_table.php:33-34. Valid on both
        // PostgreSQL and SQLite 3.8+.
        DB::statement('CREATE UNIQUE INDEX customers_external_ref_unique ON customers (integration_id, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS customers_external_ref_unique');

        Schema::table('customers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('integration_id');
            $table->dropColumn(['external_id', 'external_synced_at']);
        });
    }
};
