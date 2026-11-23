<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Owner decision 2026-11-24: presence is the default. An open HR tab (focused or not) counts as working; idle/offline only
 * after idle_timeout with no heartbeat (tab closed, device asleep, no connection). Input-based idle stays as an opt-in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_policies', function (Blueprint $table) {
            $table->boolean('idle_by_input')->default(false)->change();
        });
        DB::table('attendance_policies')->update(['idle_by_input' => false]);
    }

    public function down(): void
    {
        Schema::table('attendance_policies', function (Blueprint $table) {
            $table->boolean('idle_by_input')->default(true)->change();
        });
    }
};
