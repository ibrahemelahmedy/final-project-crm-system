<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Story 20 (WIS-20). `branch_id` is NOT NULL from creation — a department
 * must belong to exactly one branch (the intake's explicit constraint). The
 * "no branch exists yet" case is handled in the UI (disabled selector) and
 * by SaveDepartmentRequest's `required|exists:branches,id` rule, which
 * cannot pass against an empty `branches` table. There is no default branch
 * row and no sentinel id.
 *
 * `restrictOnDelete`, not cascade: no DELETE route exists for a branch, and
 * if one is ever added it must fail loudly rather than silently take
 * departments with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Two branches may each have a "Billing"; one branch may not
            // have two.
            $table->unique(['branch_id', 'name']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('departments');
    }
};
