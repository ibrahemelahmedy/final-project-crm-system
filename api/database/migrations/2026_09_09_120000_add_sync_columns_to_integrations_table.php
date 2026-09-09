<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 25 (WIS-24). Nine nullable/defaulted columns — no CHECK constraints,
 * mirroring create_integrations_table.php:36-39; the enums plus the
 * FormRequest are the authority.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            // --- inbound -------------------------------------------------------
            $table->boolean('inbound_enabled')->default(false);
            // Absolute https collection URL. NOT derived from endpoint_url
            // (Decision 8). Re-validated by the guard at send time.
            $table->string('inbound_url', 2048)->nullable();
            // {wisal_field: "dot.path.into.remote"} — Decision 5.
            $table->json('inbound_field_map')->nullable();
            // {wisal_field: "remote_wins"|"wisal_wins"} — Decision 6.
            $table->json('conflict_rules')->nullable();
            $table->timestamp('last_inbound_sync_at')->nullable();

            // --- outbound ------------------------------------------------------
            $table->boolean('outbound_enabled')->default(false);
            $table->string('outbound_url', 2048)->nullable();
            // Subset of App\Enums\IntegrationEvent::values().
            $table->json('outbound_events')->nullable();
            $table->timestamp('last_outbound_sync_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('integrations', function (Blueprint $table) {
            $table->dropColumn([
                'inbound_enabled', 'inbound_url', 'inbound_field_map', 'conflict_rules', 'last_inbound_sync_at',
                'outbound_enabled', 'outbound_url', 'outbound_events', 'last_outbound_sync_at',
            ]);
        });
    }
};
