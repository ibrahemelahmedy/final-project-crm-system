<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the audit-log viewer's filter combinations (Story 08).
 *
 * Story 01's index is ['event', 'created_at'], which serves an event filter
 * with a date range. It does NOT serve the other two combinations the viewer
 * offers, because `event` is the leading column:
 *
 *   - a date range with no event filter
 *   - an actor filter with a date range
 *
 * EXPLAIN ANALYZE on 20k rows confirmed both fell back to a Seq Scan (~7ms,
 * growing linearly) while the event path used an Index Scan (~0.1ms). The log
 * grows unbounded, so a seq scan there is the correctness risk the plan flagged
 * — verified real, and closed here.
 *
 * Both indexes lead with the column being equality- or range-filtered and
 * carry `created_at` second, so they also satisfy the viewer's mandatory
 * `ORDER BY created_at DESC` without a sort step.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('created_at', 'audit_logs_created_at_index');
            $table->index(['user_id', 'created_at'], 'audit_logs_user_id_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_created_at_index');
            $table->dropIndex('audit_logs_user_id_created_at_index');
        });
    }
};
