<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->foreignUuid('prepared_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->foreignUuid('submitted_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignUuid('paid_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->date('paid_on')->nullable();
            $table->string('early_pay_reason')->nullable();
            // Employee ids that changed the run (adjust, hold, recompute) since it was last submitted; they cannot approve it.
            $table->json('review_editors')->nullable();
            $table->boolean('self_approved')->default(false);
        });

        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->string('category', 30)->nullable();
            $table->string('source', 30)->nullable();
            $table->uuid('source_ref')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->foreignUuid('deleted_by')->nullable()->constrained('employees')->nullOnDelete();
        });
        DB::table('payroll_adjustments')->where('kind', 'bonus')->update(['category' => 'bonus']);
        DB::table('payroll_adjustments')->where('kind', 'deduction')->update(['category' => 'manual_deduction']);

        // Settings percentage wins unless the structure explicitly overrides it. Existing rows default to "no override".
        Schema::table('salary_structures', function (Blueprint $table) {
            $table->boolean('pf_override')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('salary_structures', fn (Blueprint $t) => $t->dropColumn('pf_override'));
        Schema::table('payroll_adjustments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('deleted_by');
            $table->dropColumn(['category', 'source', 'source_ref', 'deleted_at']);
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('prepared_by');
            $table->dropConstrainedForeignId('submitted_by');
            $table->dropConstrainedForeignId('paid_by');
            $table->dropColumn(['submitted_at', 'paid_on', 'early_pay_reason', 'review_editors', 'self_approved']);
        });
    }
};
