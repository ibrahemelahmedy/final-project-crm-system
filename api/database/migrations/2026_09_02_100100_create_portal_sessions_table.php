<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Story 17 (WIS-16, Customer Portal). A customer identity that is
    // deliberately NOT `personal_access_tokens` — see PortalAuth and
    // docs/decisions/ADR-005-customer-portal-access.md. A portal token is
    // structurally incapable of authenticating a staff route.
    public function up(): void
    {
        Schema::create('portal_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('token_hash')->unique();
            $table->timestamp('expires_at');
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portal_sessions');
    }
};
