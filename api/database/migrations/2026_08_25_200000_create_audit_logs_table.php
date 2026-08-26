<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event');                 // login.success | login.failed | login.inactive | logout
            $table->string('email')->nullable();     // the submitted email, retained when user_id is null
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('context')->nullable();     // promoted to jsonb on pgsql — see Task 0
            $table->timestamp('created_at')->useCurrent();
            $table->index(['event', 'created_at']);
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE audit_logs ALTER COLUMN context TYPE jsonb USING context::jsonb');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
