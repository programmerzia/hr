<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Management/HR accounts without an employee profile can still decide leave.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_approvals', function (Blueprint $table) {
            $table->dropForeign(['decided_by']);
            $table->uuid('decided_by')->nullable()->change();
            $table->foreign('decided_by')->references('id')->on('employees')->nullOnDelete();
        });
    }

    public function down(): void {}
};
