<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('shift_start', 5)->default('10:00');
            $table->string('shift_end', 5)->default('19:00');
            $table->unsignedSmallInteger('grace_minutes')->default(15);
            $table->unsignedSmallInteger('standard_minutes')->default(480);
            $table->unsignedSmallInteger('idle_timeout_minutes')->default(10);
            $table->unsignedSmallInteger('lunch_cap_minutes')->default(60);
            $table->json('late_penalty_rule');
            $table->json('weekend_days');
            $table->timestamps();
        });

        Schema::create('holidays', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date')->unique();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('attendance_days', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->enum('status', ['not_started', 'working', 'on_break', 'ended', 'on_leave', 'holiday', 'absent'])->default('not_started');
            $table->timestamp('first_in_at')->nullable();
            $table->timestamp('last_out_at')->nullable();
            $table->unsignedInteger('work_seconds')->default(0);
            $table->unsignedInteger('break_seconds')->default(0);
            $table->unsignedInteger('late_minutes')->default(0);
            $table->boolean('is_regularized')->default(false);
            $table->timestamps();
            $table->unique(['employee_id', 'date']);
            $table->index(['date', 'status']);
        });

        Schema::create('time_segments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('attendance_day_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['work', 'break']);
            $table->enum('break_category', ['short', 'tea', 'lunch', 'official', 'idle', 'signed_out', 'offline'])->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->string('note')->nullable();
            $table->enum('source', ['login', 'logout', 'idle_sweep', 'offline', 'manual'])->default('login');
            $table->timestamps();
            $table->index(['attendance_day_id', 'ended_at']);
        });

        Schema::create('task_time_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('time_segment_id')->constrained()->cascadeOnDelete();
            $table->uuid('task_id')->index();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('seconds')->default(0);
            $table->timestamps();
        });

        Schema::create('regularization_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('attendance_day_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignUuid('decided_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->uuid('current_task_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('employees', fn (Blueprint $t) => $t->dropColumn('current_task_id'));
        foreach (['regularization_requests', 'task_time_entries', 'time_segments', 'attendance_days', 'holidays', 'attendance_policies'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
