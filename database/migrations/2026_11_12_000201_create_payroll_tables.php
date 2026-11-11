<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->integer('year')->default(0);
            $table->integer('month')->default(0);
            $table->enum('status', ['draft', 'review', 'approved', 'paid'])->default('draft');
            $table->foreignUuid('approved_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('payment_reference')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->unique(['year', 'month']);
            $table->timestamps();
        });

        Schema::create('payroll_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUuid('salary_structure_id')->constrained('salary_structures')->cascadeOnDelete();
            $table->integer('standard_minutes')->default(0);
            $table->integer('worked_minutes')->default(0);
            $table->integer('overtime_minutes')->default(0);
            $table->decimal('unpaid_leave_days', 8, 2)->default(0);
            $table->integer('late_count')->default(0);
            $table->integer('gross')->default(0);
            $table->integer('overtime_pay')->default(0);
            $table->integer('unpaid_deduction')->default(0);
            $table->integer('late_deduction')->default(0);
            $table->integer('tax')->default(0);
            $table->integer('pf')->default(0);
            $table->integer('net')->default(0);
            $table->foreignUuid('bank_account_id')->nullable()->constrained('bank_accounts')->nullOnDelete();
            $table->string('payslip_path')->nullable();
            $table->unique(['run_id', 'employee_id']);
            $table->timestamps();
        });

        Schema::create('payroll_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('item_id')->constrained('payroll_items')->cascadeOnDelete();
            $table->enum('kind', ['bonus', 'deduction'])->default('bonus');
            $table->string('label');
            $table->integer('amount')->default(0);
            $table->text('note')->nullable();
            $table->foreignUuid('created_by')->constrained('employees')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_adjustments');
        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');
    }
};
