<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shared foundation for the HR/payroll upgrade (docs/07-payroll-plan.md §3).
 * Time rules stay in attendance_policies; money rules move to payroll_policies (PF off by default).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_policies', function (Blueprint $table) {
            $table->date('effective_from')->nullable()->index();
            $table->unsignedSmallInteger('half_day_after_minutes')->default(120);
            $table->unsignedSmallInteger('early_leave_grace_minutes')->default(30);
            $table->boolean('early_counts_as_late')->default(true);
            $table->unsignedSmallInteger('half_day_min_minutes')->default(240);
            $table->unsignedSmallInteger('absent_below_minutes')->default(60);
        });
        DB::table('attendance_policies')->whereNull('effective_from')->update(['effective_from' => '2000-01-01']);

        Schema::create('payroll_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('effective_from')->index();
            $table->enum('daily_rate_basis', ['working_days', 'calendar_days', 'fixed_30', 'fixed_26'])->default('working_days');
            $table->boolean('lop_enabled')->default(true);
            $table->boolean('late_penalty_enabled')->default(false);
            $table->unsignedSmallInteger('lates_per_penalty')->default(3);
            $table->decimal('penalty_days', 4, 2)->default(0.5);
            $table->decimal('max_penalty_days_per_month', 4, 2)->default(3);
            $table->boolean('pf_enabled')->default(false);
            $table->decimal('pf_employee_percent', 5, 2)->default(0);
            $table->decimal('pf_employer_percent', 5, 2)->default(0);
            $table->boolean('tax_enabled')->default(true);
            $table->boolean('overtime_enabled')->default(false);
            $table->decimal('overtime_multiplier', 4, 2)->default(1.5);
            $table->boolean('overtime_requires_approval')->default(true);
            $table->unsignedSmallInteger('overtime_min_block_minutes')->default(30);
            $table->unsignedSmallInteger('overtime_daily_cap_minutes')->default(240);
            $table->timestamps();
        });

        // Carry the old late rule over as a disabled-by-default policy row; HR enables it in Settings.
        $old = DB::table('attendance_policies')->orderBy('created_at')->first();
        $rule = $old && $old->late_penalty_rule ? json_decode($old->late_penalty_rule, true) : [];
        DB::table('payroll_policies')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'effective_from' => '2000-01-01',
            'lates_per_penalty' => (int) ($rule['lates_per_penalty'] ?? 3) ?: 3,
            'penalty_days' => (float) ($rule['penalty_days'] ?? 0.5) ?: 0.5,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        Schema::table('attendance_policies', fn (Blueprint $t) => $t->dropColumn('late_penalty_rule'));

        Schema::table('attendance_days', function (Blueprint $table) {
            $table->decimal('day_fraction', 3, 2)->default(1);
            $table->enum('absence_kind', ['none', 'unapproved', 'half_day', 'unpaid_leave', 'paid_leave', 'holiday', 'weekend', 'excused'])->default('none');
            $table->unsignedInteger('early_minutes')->default(0);
            $table->boolean('auto_closed')->default(false);
            $table->unsignedInteger('approved_overtime_minutes')->default(0);
            $table->timestamp('closed_at')->nullable();
        });

        Schema::table('regularization_requests', function (Blueprint $table) {
            $table->enum('kind', ['late', 'early', 'absent', 'auto_closed', 'overtime'])->default('late');
            $table->enum('resolution', ['excused', 'paid_leave', 'unpaid_leave', 'keep'])->nullable();
            $table->foreignUuid('leave_type_id')->nullable()->constrained('leave_types')->nullOnDelete();
        });

        Schema::table('salary_structures', function (Blueprint $table) {
            $table->decimal('pf_employer_percent', 5, 2)->nullable();
            $table->json('other_allowances')->nullable();
            $table->string('note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('salary_structures', fn (Blueprint $t) => $t->dropColumn(['pf_employer_percent', 'other_allowances', 'note']));
        Schema::table('regularization_requests', function (Blueprint $t) {
            $t->dropConstrainedForeignId('leave_type_id');
            $t->dropColumn(['kind', 'resolution']);
        });
        Schema::table('attendance_days', fn (Blueprint $t) => $t->dropColumn(['day_fraction', 'absence_kind', 'early_minutes', 'auto_closed', 'approved_overtime_minutes', 'closed_at']));
        Schema::table('attendance_policies', fn (Blueprint $t) => $t->json('late_penalty_rule')->nullable());
        Schema::dropIfExists('payroll_policies');
        Schema::table('attendance_policies', fn (Blueprint $t) => $t->dropColumn(['effective_from', 'half_day_after_minutes', 'early_leave_grace_minutes', 'early_counts_as_late', 'half_day_min_minutes', 'absent_below_minutes']));
    }
};
