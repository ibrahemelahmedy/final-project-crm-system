<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Story 26 (WIS-22), Decision 11. Modelled on portal_sessions. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
            // sha256 of the plaintext token, never the token.
            $table->string('token_hash')->unique();
            // Nullable until the visitor identifies themselves.
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
            $table->string('visitor_name', 120)->nullable();
            $table->string('visitor_email', 191)->nullable();
            // The Origin header at start, checked against config->allowed_origins.
            $table->string('origin', 255)->nullable();
            $table->unsignedInteger('message_count')->default(0);
            $table->unsignedBigInteger('last_seen_message_id')->nullable(); // read cursor
            $table->timestamp('expires_at');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['ticket_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_sessions');
    }
};
