<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $t) {
            $t->foreignUuid('cancelled_by')->nullable()->constrained('employees')->nullOnDelete();
            $t->timestamp('cancelled_at')->nullable();
            $t->foreignUuid('ended_early_by')->nullable()->constrained('employees')->nullOnDelete();
            $t->timestamp('ended_early_at')->nullable();
            $t->index(['employee_id', 'starts_on'], 'leave_requests_employee_starts_idx');
            $t->index('status', 'leave_requests_status_idx');
        });
        Schema::table('regularization_requests', fn (Blueprint $t) => $t->index(['employee_id', 'status'], 'regularization_employee_status_idx'));
        Schema::table('activity_log_entries', fn (Blueprint $t) => $t->index(['subject_type', 'subject_id', 'created_at'], 'activity_subject_created_idx'));
    }

    public function down(): void
    {
        Schema::table('activity_log_entries', fn (Blueprint $t) => $t->dropIndex('activity_subject_created_idx'));
        Schema::table('regularization_requests', fn (Blueprint $t) => $t->dropIndex('regularization_employee_status_idx'));
        Schema::table('leave_requests', function (Blueprint $t) {
            $t->dropIndex('leave_requests_employee_starts_idx');
            $t->dropIndex('leave_requests_status_idx');
            $t->dropConstrainedForeignId('cancelled_by');
            $t->dropConstrainedForeignId('ended_early_by');
            $t->dropColumn(['cancelled_at', 'ended_early_at']);
        });
    }
};
