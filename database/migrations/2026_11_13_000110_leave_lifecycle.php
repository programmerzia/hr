<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $t) {
            $t->decimal('carry_forward_cap', 5, 2)->nullable();
            $t->boolean('allowed_on_probation')->default(true);
            $t->boolean('encashable')->default(false);
        });
        Schema::table('leave_balances', function (Blueprint $t) {
            $t->decimal('carried_in', 8, 2)->default(0);
            $t->decimal('encashed', 8, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('leave_types', fn (Blueprint $t) => $t->dropColumn(['carry_forward_cap', 'allowed_on_probation', 'encashable']));
        Schema::table('leave_balances', fn (Blueprint $t) => $t->dropColumn(['carried_in', 'encashed']));
    }
};
