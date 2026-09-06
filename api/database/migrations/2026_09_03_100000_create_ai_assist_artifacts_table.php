<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 19 (WIS-18, AI Assist). One row per (ticket_id, kind); a regenerate
 * REPLACES the row rather than appending — Decision 5 in the story plan.
 * No CHECK constraint is needed here, so unlike
 * 2026_08_28_160000_create_csat_surveys_table.php there is no SQLite branch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_assist_artifacts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
            $table->string('kind', 24); // AssistKind: summary | suggested_reply
            $table->text('content');
            $table->string('model', 64);
            $table->string('locale', 8); // the locale it was GENERATED in
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('source_message_id')->nullable(); // newest message in the prompt
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->timestamp('dismissed_at')->nullable(); // suggested_reply only
            $table->timestamps();

            $table->unique(['ticket_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_assist_artifacts');
    }
};
