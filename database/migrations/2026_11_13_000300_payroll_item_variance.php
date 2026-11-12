<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->boolean('variance_flag')->default(false);
            $table->enum('variance_kind', ['none', 'up', 'down', 'new'])->default('none');
            $table->decimal('variance_pct', 8, 2)->nullable();
            $table->foreignUuid('variance_ack_by')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('variance_ack_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('variance_ack_by');
            $table->dropColumn(['variance_flag', 'variance_kind', 'variance_pct', 'variance_ack_at']);
        });
    }
};
