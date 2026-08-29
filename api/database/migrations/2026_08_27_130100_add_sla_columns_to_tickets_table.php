<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Which rule produced the timestamps below. Kept for display and for
            // auto_close_after_days; the timestamps themselves never re-derive
            // from it, which is what makes a rule edit non-retroactive.
            $table->foreignId('sla_rule_id')->nullable()->constrained('sla_rules')->nullOnDelete();

            $table->timestamp('first_response_due_at')->nullable();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('resolution_due_at')->nullable();

            // Precomputed at_risk boundary: resolution_due_at minus the unconsumed
            // share of the target. Stored so the engine compares, never calculates.
            $table->timestamp('sla_at_risk_at')->nullable();

            // Precomputed escalation moment. NULL = this ticket never escalates.
            $table->timestamp('escalate_at')->nullable();

            // Pending-clock pause. sla_paused_at is non-null ONLY while the ticket
            // is Pending; sla_paused_minutes is the running total already added
            // back into the four timestamps above.
            $table->timestamp('sla_paused_at')->nullable();
            $table->unsignedInteger('sla_paused_minutes')->default(0);

            // Once-only guards. The engine is idempotent because of these two.
            $table->timestamp('sla_at_risk_notified_at')->nullable();
            $table->timestamp('sla_breached_notified_at')->nullable();

            $table->timestamp('escalated_at')->nullable();

            // One index per engine query. Each leads with `status` because every
            // engine query excludes resolved/closed rows first.
            $table->index(['status', 'resolution_due_at'], 'tickets_sla_resolution_index');
            $table->index(['status', 'sla_at_risk_at'], 'tickets_sla_at_risk_index');
            $table->index(['status', 'escalate_at'], 'tickets_sla_escalate_index');
            $table->index(['status', 'resolved_at'], 'tickets_sla_autoclose_index');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_sla_resolution_index');
            $table->dropIndex('tickets_sla_at_risk_index');
            $table->dropIndex('tickets_sla_escalate_index');
            $table->dropIndex('tickets_sla_autoclose_index');
            $table->dropConstrainedForeignId('sla_rule_id');
            $table->dropColumn([
                'first_response_due_at', 'first_response_at', 'resolution_due_at',
                'sla_at_risk_at', 'escalate_at', 'sla_paused_at', 'sla_paused_minutes',
                'sla_at_risk_notified_at', 'sla_breached_notified_at', 'escalated_at',
            ]);
        });
    }
};
