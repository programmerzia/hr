<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Wave P2.7: festival bonus percent + label on runs, leave encashment on items. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->decimal('bonus_percent_of_basic', 5, 2)->nullable();
            $table->string('label')->nullable();
        });
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->integer('leave_encashment')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('payroll_items', fn (Blueprint $t) => $t->dropColumn('leave_encashment'));
        Schema::table('payroll_runs', fn (Blueprint $t) => $t->dropColumn(['bonus_percent_of_basic', 'label']));
    }
};
