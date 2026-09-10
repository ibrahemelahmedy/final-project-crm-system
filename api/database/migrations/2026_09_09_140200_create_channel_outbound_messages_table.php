<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Story 26 (WIS-22), Decision 8. Mirrors integration_outbox. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_outbound_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->foreignId('ticket_message_id')->constrained('ticket_messages')->cascadeOnDelete();

            // Resolved at enqueue, not at send.
            $table->string('recipient', 191);
            $table->text('body');
            // The Message-ID / provider id we EMITTED.
            $table->string('provider_message_id', 191)->nullable();
            // The inbound Message-ID this reply answers.
            $table->string('in_reply_to', 191)->nullable();

            $table->string('status', 16)->default('pending'); // ChannelDeliveryStatus
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('next_attempt_at')->nullable();
            $table->unsignedSmallInteger('last_status')->nullable();
            $table->string('last_error_key', 120)->nullable(); // i18n key only
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            // Decision 8: one reply, one delivery, however many times enqueue runs.
            $table->unique(['channel_connection_id', 'ticket_message_id']);
            $table->index(['status', 'next_attempt_at']);
            $table->index('provider_message_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_outbound_messages');
    }
};
