<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dateTime('last_activity_at')->nullable()->after('last_out_at');
        });
        // Idle detected from the last real input in the app (docs/09 A6), as opposed to the sweep for closed tabs.
        DB::statement("ALTER TABLE time_segments MODIFY source ENUM('login','logout','idle_sweep','idle','offline','manual') NOT NULL DEFAULT 'login'");
    }

    public function down(): void
    {
        Schema::table('attendance_days', function (Blueprint $table) {
            $table->dropColumn('last_activity_at');
        });
        DB::statement("UPDATE time_segments SET source = 'idle_sweep' WHERE source = 'idle'");
        DB::statement("ALTER TABLE time_segments MODIFY source ENUM('login','logout','idle_sweep','offline','manual') NOT NULL DEFAULT 'login'");
    }
};
