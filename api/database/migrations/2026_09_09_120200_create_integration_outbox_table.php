<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 25 (WIS-24). The outbox pattern — a plain unique() is correct here
 * (unlike `customers`) because there are no soft deletes on this table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_outbox', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integration_id')->constrained('integrations')->cascadeOnDelete();

            $table->string('event', 32);       // App\Enums\IntegrationEvent
            // Deterministic dedupe key — Decision 4. e.g. "ticket.resolved:412:2".
            $table->string('event_id', 120);
            // The exact JSON body POSTed, built once at enqueue so a later retry
            // sends what the event described, not what the row looks like today.
            $table->json('payload');

            $table->string('status', 16)->default('pending'); // App\Enums\OutboxStatus
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('next_attempt_at')->nullable();

            $table->unsignedSmallInteger('last_status')->nullable(); // HTTP status
            // i18n key only. Same rule as sync_runs.error_key.
            $table->string('last_error_key', 120)->nullable();

            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            // The idempotency guarantee (Decision 4): one row per (integration, event).
            $table->unique(['integration_id', 'event_id']);
            $table->index(['status', 'next_attempt_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_outbox');
    }
};
