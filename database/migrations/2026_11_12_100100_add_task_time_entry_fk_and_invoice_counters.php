<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_counters', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last')->default(0);
        });

        // Orphaned entries (task removed) cannot satisfy the key.
        DB::table('task_time_entries')->whereNotIn('task_id', DB::table('tasks')->select('id'))->delete();
        // SQLite cannot add a foreign key to an existing table; MySQL (production, test suite) gets it.
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('task_time_entries', fn (Blueprint $t) => $t->foreign('task_id')->references('id')->on('tasks')->restrictOnDelete());
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('task_time_entries', fn (Blueprint $t) => $t->dropForeign(['task_id']));
        }
        Schema::dropIfExists('invoice_counters');
    }
};
