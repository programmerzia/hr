<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Short outages are recorded: a gap between heartbeats longer than offline_after_minutes (default 3; browsers throttle
 * background tabs to one beat per 1-2 min) is offline from the last beat. heartbeat_ticks (one row per user per minute)
 * lets the server tell its own outage (everyone silent at once, counted as work) from one person's.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_policies', function (Blueprint $table) {
            $table->unsignedSmallInteger('offline_after_minutes')->default(3)->after('idle_timeout_minutes');
        });
        Schema::create('heartbeat_ticks', function (Blueprint $table) {
            $table->dateTime('minute');
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['minute', 'user_id']);
        });
        DB::statement("ALTER TABLE time_segments MODIFY source ENUM('login','logout','idle_sweep','idle','offline','manual','outage','correction') NOT NULL DEFAULT 'login'");
    }

    public function down(): void
    {
        DB::statement("UPDATE time_segments SET source = 'login' WHERE source IN ('outage','correction')");
        DB::statement("ALTER TABLE time_segments MODIFY source ENUM('login','logout','idle_sweep','idle','offline','manual') NOT NULL DEFAULT 'login'");
        Schema::dropIfExists('heartbeat_ticks');
        Schema::table('attendance_policies', function (Blueprint $table) {
            $table->dropColumn('offline_after_minutes');
        });
    }
};
