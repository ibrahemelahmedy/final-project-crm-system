<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 20 (WIS-20). A branch is an organisational location, not a tenant —
 * one company, several branches. `region` is nullable: the design's "Remote
 * Team" row renders REGION as "—".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('region')->nullable();
            // An IANA identifier ('Asia/Riyadh'), validated with the
            // `timezone` rule server-side. Not an offset — offsets move
            // twice a year.
            $table->string('timezone')->default('UTC');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('name');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
