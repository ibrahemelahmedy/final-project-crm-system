<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Plain string, not an enum column — App\Enums\NotificationType is
            // the registry. A new case is a code change, never a migration.
            $table->string('type');
            $table->string('title');
            $table->text('body')->nullable();
            // The morph pair identifying the source record (a Ticket today).
            // Nullable: a notification is never blocked on having one.
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            // The SPA route to navigate to on activation. Stored at dispatch
            // time (Story 11 default) rather than derived at read time.
            $table->string('link_to')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            // The unread-count query runs on every page load for every user.
            $table->index(['user_id', 'read_at']);
            // The paginated list query.
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
