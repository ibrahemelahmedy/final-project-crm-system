<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 24 (WIS-23), Decision 6. One row per chatbot turn.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portal_chat_conversation_id')
                ->constrained('portal_chat_conversations')->cascadeOnDelete();
            $table->string('role', 16); // 'customer' | 'assistant'
            $table->text('body');
            // [{id, slug, title}] — only slugs that were actually OFFERED to the
            // model survive (Decision 7). Cast 'array'.
            $table->json('citations')->nullable();
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->timestamps();

            $table->index(['portal_chat_conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_chat_messages');
    }
};
