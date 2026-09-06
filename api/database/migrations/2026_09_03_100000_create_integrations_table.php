<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Story 18 (WIS-19, Integrations & ERP — Admin Connection Management). One
// row per configured integration type. The absence of a row IS the
// "not connected" state — see App\Enums\IntegrationType /
// App\Enums\IntegrationStatus — so disconnecting is a DELETE, not a flag.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();

            // One rule per type, mirroring sla_rules' one-rule-per-priority
            // unique constraint.
            $table->string('type', 32)->unique();

            $table->string('endpoint_url', 2048);

            // Laravel's `encrypted` cast (APP_KEY, AES-256-CBC). Ciphertext is
            // ~1.4x the plaintext plus a MAC envelope, so `text`, never a
            // sized string.
            $table->text('secret')->nullable();

            // The ONLY thing about the secret that ever leaves the server.
            $table->string('secret_last_four', 4)->nullable();

            // 'connected' | 'error'. There is no 'not_connected' value — that
            // state is the absent row. A CHECK constraint is deliberately
            // omitted (cross-engine rule, .squad/plans/00-index.md);
            // IntegrationStatus and the FormRequest are the authority.
            $table->string('status', 16)->default('connected');

            // Decision 3 (story plan): CHECKED, not SYNCED. Nothing in this
            // release syncs.
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamp('last_check_failed_at')->nullable();

            // The reachability failure reason, already localised (an i18n
            // key) at write time. Never contains the secret —
            // HttpIntegrationTester never stores a raw exception message.
            $table->string('last_error', 500)->nullable();

            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
