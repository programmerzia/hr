<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Wave P0.2 (docs/07-payroll-plan.md §3): item snapshot, run kinds/reopen, PF ledger. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->json('components')->nullable();
            $table->json('slices')->nullable();
            $table->decimal('eligible_days', 6, 2)->default(0);
            $table->decimal('absent_days', 6, 2)->default(0);
            $table->decimal('half_days', 6, 2)->default(0);
            $table->decimal('paid_leave_days', 6, 2)->default(0);
            $table->decimal('holiday_days', 6, 2)->default(0);
            $table->decimal('lop_days', 6, 2)->default(0);
            $table->decimal('late_penalty_days', 6, 2)->default(0);
            $table->decimal('day_fraction_total', 6, 2)->default(0);
            $table->integer('pf_employer')->default(0);
            $table->boolean('hold')->default(false);
            $table->string('hold_reason')->nullable();
            $table->foreignUuid('payroll_policy_id')->nullable()->constrained('payroll_policies')->nullOnDelete();
            $table->foreignUuid('attendance_policy_id')->nullable()->constrained('attendance_policies')->nullOnDelete();
            $table->timestamp('snapshot_at')->nullable();
        });

        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->enum('kind', ['regular', 'festival', 'settlement'])->default('regular');
            $table->foreignUuid('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('reopened_at')->nullable();
            $table->foreignUuid('reopened_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('reopen_reason')->nullable();
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique(['year', 'month']);
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->unique(['year', 'month', 'kind', 'employee_id']);
        });

        Schema::create('pf_ledger', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('item_id')->unique()->constrained('payroll_items')->cascadeOnDelete();
            $table->foreignUuid('run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->restrictOnDelete();
            $table->integer('year');
            $table->integer('month');
            $table->integer('employee_amount')->default(0);
            $table->integer('employer_amount')->default(0);
            $table->bigInteger('cumulative_employee')->default(0);
            $table->bigInteger('cumulative_employer')->default(0);
            $table->timestamps();
            $table->index(['employee_id', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pf_ledger');
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropUnique(['year', 'month', 'kind', 'employee_id']);
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->unique(['year', 'month']);
            $table->dropConstrainedForeignId('employee_id');
            $table->dropConstrainedForeignId('reopened_by');
            $table->dropColumn(['kind', 'reopened_at', 'reopen_reason']);
        });
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payroll_policy_id');
            $table->dropConstrainedForeignId('attendance_policy_id');
            $table->dropColumn(['components', 'slices', 'eligible_days', 'absent_days', 'half_days', 'paid_leave_days', 'holiday_days',
                'lop_days', 'late_penalty_days', 'day_fraction_total', 'pf_employer', 'hold', 'hold_reason', 'snapshot_at']);
        });
    }
};
