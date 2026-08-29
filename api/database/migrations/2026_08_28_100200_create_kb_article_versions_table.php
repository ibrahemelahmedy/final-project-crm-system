<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kb_article_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('kb_article_id')->constrained('kb_articles')->cascadeOnDelete();
            // The PRE-edit snapshot, written inside the same transaction as the
            // update. Concurrent edits are last-write-wins; nothing is lost
            // because every write leaves its predecessor here.
            $table->string('title');
            $table->longText('body')->nullable();
            $table->foreignId('edited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['kb_article_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kb_article_versions');
    }
};
