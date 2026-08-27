<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expands the minimal tickets scaffold created in
     * 2026_08_25_200001_create_tickets_table.php (Story 01). That file is
     * frozen — every ticket column added after it lands here or later.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Nullable here; migration B flips it to NOT NULL after cleanup.
            $table->foreignId('customer_id')->nullable()->after('subject')
                ->constrained('customers')->restrictOnDelete();

            $table->foreignId('created_by')->nullable()->after('assigned_to')
                ->constrained('users')->nullOnDelete();

            $table->text('description')->nullable()->after('subject');
            $table->string('category', 32)->default('general')->after('priority');
            $table->string('channel', 16)->default('email')->after('category');

            $table->timestamp('resolved_at')->nullable()->after('channel');
            $table->timestamp('closed_at')->nullable()->after('resolved_at');

            // Composite indexes chosen for the queue's actual access paths:
            // an Agent's own queue sorted newest-first, and the faceted filters.
            $table->index(['assigned_to', 'status', 'created_at'], 'tickets_agent_queue_index');
            $table->index(['status', 'priority'], 'tickets_status_priority_index');
            $table->index('customer_id');
            $table->index('channel');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_agent_queue_index');
            $table->dropIndex('tickets_status_priority_index');
            $table->dropIndex(['channel']);
            $table->dropConstrainedForeignId('customer_id');
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['description', 'category', 'channel', 'resolved_at', 'closed_at']);
        });
    }
};
