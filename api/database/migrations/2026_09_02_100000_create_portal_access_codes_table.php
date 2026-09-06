<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Story 17 (WIS-16, Customer Portal). One row per OTP issue. `customer_id`
    // is NOT nullable — a row exists only when the identifier matched a live
    // customers row; an unmatched request writes nothing (see PortalAccess).
    public function up(): void
    {
        Schema::create('portal_access_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('identifier', 191);
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('request_ip', 45)->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'created_at']);
            $table->index(['identifier', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_access_codes');
    }
};
