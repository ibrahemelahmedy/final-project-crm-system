<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Owned by the Customer Management story (WIS-4). The Ticket Management
    // story adds tickets.customer_id pointing here; it does not edit this file.
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();              // stored lower-cased
            $table->string('phone', 32)->nullable();          // stored as entered
            $table->string('phone_normalized', 32)->nullable(); // derived; never client-supplied
            $table->string('company')->nullable();
            $table->string('tier', 20)->default('standard');
            $table->timestamp('last_contact_at')->nullable(); // written by the Conversation Thread story
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();

            $table->index('company');
            $table->index('tier');
            $table->index('last_contact_at');
        });

        // Partial unique indexes — the schema builder has no API for these.
        // Valid on both PostgreSQL (dev, .env line 23) and SQLite 3.8+ (tests, phpunit.xml).
        DB::statement('CREATE UNIQUE INDEX customers_email_unique ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX customers_phone_normalized_unique ON customers (phone_normalized) WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
