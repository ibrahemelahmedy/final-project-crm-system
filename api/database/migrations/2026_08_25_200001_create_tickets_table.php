<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // The Ticket Management story expands this table
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->string('status')->default('open');
            $table->string('priority')->default('normal');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('assigned_to');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
