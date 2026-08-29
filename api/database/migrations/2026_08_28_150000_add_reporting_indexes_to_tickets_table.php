<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Story 12 (Reports & Management Dashboards) — indexes only.
     *
     * The reporting aggregations bucket ticket volume by DATE(created_at) and
     * DATE(resolved_at), and group agent performance by assignee over
     * resolved_at. Story 04 owns the `tickets` table and its columns; this
     * migration adds only the indexes this story needs and never alters a
     * Story 04 column.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->index('created_at', 'tickets_reports_created_index');
            $table->index('resolved_at', 'tickets_reports_resolved_index');
            $table->index(['assigned_to', 'resolved_at'], 'tickets_reports_agent_perf_index');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_reports_created_index');
            $table->dropIndex('tickets_reports_resolved_index');
            $table->dropIndex('tickets_reports_agent_perf_index');
        });
    }
};
