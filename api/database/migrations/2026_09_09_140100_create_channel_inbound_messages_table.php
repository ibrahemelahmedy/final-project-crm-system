<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 26 (WIS-22), Decision 5. The idempotency ledger AND the email
 * threading map.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_inbound_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
            // The PROVIDER's own id: WhatsApp messages[0].id, Twilio
            // MessageSid, the RFC-5322 Message-ID. 191 to stay inside a btree
            // key on any engine.
            $table->string('provider_message_id', 191);
            // The header this message threaded against (In-Reply-To /
            // References tail), so Decision 6's email branch is one indexed lookup.
            $table->string('external_thread_ref', 191)->nullable();

            $table->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
            $table->foreignId('ticket_message_id')->nullable()->constrained('ticket_messages')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            // Whether this arrival opened a ticket or appended to one.
            $table->string('outcome', 16); // created | appended | ignored
            $table->timestamp('received_at');
            $table->timestamps();

            // THE idempotency guarantee (Decision 5). A plain unique() is
            // correct — no soft deletes on this table.
            $table->unique(['channel_connection_id', 'provider_message_id']);
            $table->index('external_thread_ref');
            $table->index(['ticket_id', 'received_at']);
            // Powers the /channels 24h inbound count in ONE aggregate.
            $table->index(['channel_connection_id', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_inbound_messages');
    }
};
