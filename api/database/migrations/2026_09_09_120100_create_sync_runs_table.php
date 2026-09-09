<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 25 (WIS-24). One table for both directions — see App\Models\SyncRun's
 * docblock for the per-direction meaning of each counter (Decision 9).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integration_id')->constrained('integrations')->cascadeOnDelete();
            $table->string('direction', 16);   // App\Enums\SyncDirection
            $table->string('trigger', 16);     // App\Enums\SyncRunTrigger
            $table->string('status', 16)->default('running'); // App\Enums\SyncRunStatus

            // See App\Models\SyncRun's docblock for the per-direction meaning of
            // each counter (Decision 9). Do not re-document it anywhere else.
            $table->unsignedInteger('records_read')->default(0);
            $table->unsignedInteger('records_created')->default(0);
            $table->unsignedInteger('records_updated')->default(0);
            $table->unsignedInteger('records_skipped')->default(0);
            $table->unsignedInteger('records_failed')->default(0);

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();

            // Run-level failure reason, ALWAYS an i18n key
            // (integrations.sync.error.*) — never a raw exception message. A
            // transport exception can embed the Authorization header
            // (HttpIntegrationTester.php:60-64).
            $table->string('error_key', 120)->nullable();

            // Per-row detail, capped at config('integrations.sync.max_error_rows'):
            // [{external_id, field, reason_key, detail}] with `detail` sanitised and
            // truncated. Never a payload, never a secret.
            $table->json('errors')->nullable();

            $table->timestamps();

            $table->index(['integration_id', 'started_at']);
            $table->index(['direction', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_runs');
    }
};
