<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->uuid('user_id')->nullable()->index();
            $table->string('name');
            $table->string('email')->unique();
            $table->foreignUuid('department_id')->constrained();
            $table->uuid('team_id')->nullable()->index();
            $table->string('designation');
            $table->enum('employment_type', ['full_time', 'contractor', 'intern']);
            $table->enum('status', ['active', 'probation', 'on_leave', 'resigned', 'terminated'])->default('active');
            $table->date('joined_on');
            $table->date('probation_until')->nullable();
            $table->date('exited_on')->nullable();
            $table->string('phone')->default('');
            $table->string('nid')->default('');
            $table->string('avatar_path')->nullable();
            $table->timestamps();
        });

        Schema::create('teams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->foreignUuid('department_id')->constrained();
            $table->foreignUuid('lead_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->foreign('team_id')->references('id')->on('teams')->nullOnDelete();
        });

        Schema::create('team_members', function (Blueprint $table) {
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->primary(['team_id', 'employee_id']);
        });

        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['employee', 'team_lead', 'hr', 'management'])->default('employee');
            $table->foreignUuid('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('must_change_password')->default(false);
            $table->timestamp('last_seen_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->uuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('salary_structures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->date('effective_from');
            $table->unsignedInteger('basic')->default(0);
            $table->unsignedInteger('house_rent')->default(0);
            $table->unsignedInteger('medical')->default(0);
            $table->unsignedInteger('conveyance')->default(0);
            $table->decimal('pf_percent', 5, 2)->default(0);
            $table->unsignedInteger('tax_monthly')->default(0);
            $table->unsignedInteger('gross')->default(0);
            $table->unsignedInteger('hourly_rate')->default(0);
            $table->timestamps();
            $table->index(['employee_id', 'effective_from']);
        });

        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->string('bank');
            $table->string('account_name');
            $table->string('account_no');
            $table->string('routing_no');
            $table->string('branch');
            $table->boolean('is_primary')->default(true);
            $table->timestamps();
        });

        Schema::create('employee_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['nid', 'contract', 'cv', 'certificate', 'other']);
            $table->string('name');
            $table->string('path');
            $table->timestamp('uploaded_at');
            $table->timestamps();
        });

        Schema::create('employee_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('tag');
            $table->date('assigned_on');
            $table->date('returned_on')->nullable();
            $table->enum('status', ['assigned', 'returned', 'lost'])->default('assigned');
            $table->timestamps();
        });

        Schema::create('onboarding_checklist_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('employee_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->boolean('done')->default(false);
            $table->timestamp('done_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (['onboarding_checklist_items', 'employee_assets', 'employee_documents', 'bank_accounts', 'salary_structures', 'sessions', 'password_reset_tokens', 'users', 'team_members', 'teams', 'employees', 'departments'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::enableForeignKeyConstraints();
    }
};
