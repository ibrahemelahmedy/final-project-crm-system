<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 24 (WIS-23), Decision 3. The AI classification lives on the ticket
 * row, not in ai_assist_artifacts: the queue must FILTER on needs_triage,
 * which a TEXT blob cannot do.
 *
 * NOTHING here writes tickets.category or tickets.priority — see Decision 4.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('ai_suggested_category', 32)->nullable();
            $table->string('ai_suggested_priority', 16)->nullable();
            // 0.00 … 1.00. Cast to float on the model — the `decimal` cast
            // returns a STRING, and pgsql returns numeric as a string over PDO.
            $table->decimal('ai_confidence', 3, 2)->nullable();
            // NULL means "never classified" (provider failure / feature off),
            // which is distinct from "classified and found ambiguous".
            $table->timestamp('ai_classified_at')->nullable();
            // 64 to match ai_assist_artifacts.model and the existing clamp at
            // OpenAiCompatibleAssistGenerator.php:82. Clamp, do not widen.
            $table->string('ai_classification_model', 64)->nullable();
            $table->boolean('needs_triage')->default(false);

            $table->index('needs_triage');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex(['needs_triage']);
            $table->dropColumn([
                'ai_suggested_category', 'ai_suggested_priority', 'ai_confidence',
                'ai_classified_at', 'ai_classification_model', 'needs_triage',
            ]);
        });
    }
};
