<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 10. Adds the public/internal split to Story 05's table WITHOUT
 * editing Story 05's own migration. Not-null + defaulted, so it is safe on
 * a populated `ticket_messages` table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_messages', function (Blueprint $table) {
            $table->string('visibility', 16)->default('public')->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('ticket_messages', function (Blueprint $table) {
            $table->dropColumn('visibility');
        });
    }
};
