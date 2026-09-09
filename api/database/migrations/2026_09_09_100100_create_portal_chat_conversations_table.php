<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 24 (WIS-23), Decision 6. One live chatbot conversation per portal
 * session — keyed on the SESSION, not the customer: signing out ends the
 * conversation and its ceiling.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portal_session_id')->constrained('portal_sessions')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('locale', 8);
            $table->string('state', 16)->default('active'); // App\Enums\PortalChatState
            $table->unsignedInteger('message_count')->default(0);
            // The PROVIDER's own reported counts, accumulated. No tokenizer here.
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->foreignId('escalated_ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
            $table->timestamps();

            $table->index('portal_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_chat_conversations');
    }
};
