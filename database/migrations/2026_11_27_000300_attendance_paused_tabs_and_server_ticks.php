<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * - regularization_requests.kind gains 'paused': ask to count time the browser paused the HR tab as work.
 * - server_ticks: one row per minute in which the scheduler's attendance:sweep ran. A stretch without ticks is the
 *   server's own outage (counted as work); everyone going silent while the server kept ticking is not.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE regularization_requests MODIFY kind ENUM('late','early','absent','auto_closed','overtime','paused') NOT NULL DEFAULT 'late'");
        Schema::create('server_ticks', function (Blueprint $table) {
            $table->dateTime('minute')->primary();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_ticks');
        DB::statement("DELETE FROM regularization_requests WHERE kind = 'paused'");
        DB::statement("ALTER TABLE regularization_requests MODIFY kind ENUM('late','early','absent','auto_closed','overtime') NOT NULL DEFAULT 'late'");
    }
};
