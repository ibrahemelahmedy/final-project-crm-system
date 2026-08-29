<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kb_articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            // Unique and FROZEN after creation — see KbArticle::freshSlug().
            // A rename never repoints an existing published slug, so a link
            // pasted into a ticket reply four months ago still resolves.
            $table->string('slug')->unique();
            // `body` is the raw Markdown, retained verbatim for editing.
            $table->longText('body')->nullable();
            // `body_html` is the SANITIZED render. The client renders only
            // this — App\Services\MarkdownRenderer is the single write path.
            $table->longText('body_html')->nullable();
            $table->string('excerpt', 400)->nullable();
            $table->foreignId('kb_category_id')->nullable()->constrained('kb_categories')->nullOnDelete();
            $table->string('status')->default('draft'); // App\Enums\ArticleStatus
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->unsignedInteger('view_count')->default(0);
            $table->timestamps();

            $table->index(['status', 'kb_category_id']);
            $table->index('published_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kb_articles');
    }
};
