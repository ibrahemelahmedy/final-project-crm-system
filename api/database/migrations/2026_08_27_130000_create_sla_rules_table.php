<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_rules', function (Blueprint $table) {
            $table->id();

            // One rule per priority tier. The unique index is the product rule:
            // four tiers, four cards, no ambiguity about which rule applies.
            $table->string('priority', 16)->unique();

            $table->unsignedInteger('first_response_minutes');
            $table->unsignedInteger('resolution_minutes');

            // Percent of the resolution target consumed before a ticket reads
            // "at risk". Precomputed into tickets.sla_at_risk_at at creation.
            $table->unsignedTinyInteger('at_risk_threshold_pct')->default(80);

            $table->boolean('notify_on_breach')->default(true);
            $table->boolean('escalation_enabled')->default(false);

            // Minutes after first_response_due_at at which an unanswered ticket
            // escalates. NULL with escalation_enabled = true means "escalate on
            // breach" (the design card's ON BREACH action).
            $table->unsignedInteger('escalate_after_minutes')->nullable();

            // 'team_lead' or 'administrator'. Validated against UserRole.
            $table->string('escalate_to_role', 16)->nullable();

            // Days a Resolved ticket waits before auto-closing. NULL = never.
            $table->unsignedSmallInteger('auto_close_after_days')->nullable();

            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_rules');
    }
};
