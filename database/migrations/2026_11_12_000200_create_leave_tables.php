<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->decimal('annual_quota', 8, 2)->default(0);
            $table->boolean('is_paid')->default(false);
            $table->boolean('carry_forward')->default(false);
            $table->boolean('allows_half_day')->default(false);
            $table->timestamps();
        });

        Schema::create('leave_balances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUuid('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->integer('year')->default(0);
            $table->decimal('entitled', 8, 2)->default(0);
            $table->decimal('used', 8, 2)->default(0);
            $table->decimal('pending', 8, 2)->default(0);
            $table->unique(['employee_id', 'leave_type_id', 'year']);
            $table->timestamps();
        });

        Schema::create('leave_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUuid('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->enum('half_day', ['none', 'first_half', 'second_half'])->default('none');
            $table->decimal('days', 8, 2)->default(0);
            $table->text('reason');
            $table->string('attachment_path')->nullable();
            $table->enum('status', ['pending_lead', 'pending_hr', 'approved', 'rejected', 'cancelled'])->default('pending_lead');
            $table->timestamps();
        });

        Schema::create('leave_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('leave_request_id')->constrained('leave_requests')->cascadeOnDelete();
            $table->enum('stage', ['lead', 'hr'])->default('lead');
            $table->foreignUuid('decided_by')->constrained('employees')->cascadeOnDelete();
            $table->enum('decision', ['approved', 'rejected'])->default('approved');
            $table->text('note')->nullable();
            $table->timestamp('decided_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_approvals');
        Schema::dropIfExists('leave_requests');
        Schema::dropIfExists('leave_balances');
        Schema::dropIfExists('leave_types');
    }
};
