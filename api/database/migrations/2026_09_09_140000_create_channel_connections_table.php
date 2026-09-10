<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 26 (WIS-22), Decision 1. One row per LIVE channel. The ABSENT row is
 * the not_connected state — no CHECK constraints (cross-engine rule,
 * .squad/plans/00-index.md:136-140); the enums plus the FormRequest are the
 * authority.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_connections', function (Blueprint $table) {
            $table->id();
            // App\Enums\Channel value. Unique: one connection per channel,
            // mirroring integrations.type.
            $table->string('channel', 16)->unique();
            $table->string('provider', 32); // App\Enums\ChannelProvider

            // Laravel's `encrypted` cast. text, never a sized string.
            $table->text('secret')->nullable();
            $table->string('secret_last_four', 4)->nullable(); // the ONLY thing that leaves
            $table->text('verify_token')->nullable(); // WhatsApp handshake; encrypted

            // Non-secret provider settings: phone_number_id, from_number,
            // account_sid, inbound_address, allowed_origins[], site_key.
            // NEVER a credential.
            $table->json('config')->nullable();

            $table->string('status', 16)->default('connected'); // ChannelConnectionStatus
            $table->timestamp('last_inbound_at')->nullable();
            $table->timestamp('last_outbound_at')->nullable();
            // Already an i18n key at write time (channels.error.*). NEVER a raw
            // exception message.
            $table->string('last_error_key', 120)->nullable();
            $table->timestamp('last_error_at')->nullable();

            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_connections');
    }
};
