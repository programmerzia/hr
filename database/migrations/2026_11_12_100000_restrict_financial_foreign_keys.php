<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Money records must never vanish because a parent row is deleted: payroll items, claims and invoices now block
 * deletion of their employee, salary structure or client. SQLite cannot alter foreign keys in place, so the swap only
 * runs on MySQL (production and the test suite); the SQLite test database keeps the original cascade.
 */
return new class extends Migration
{
    private const KEYS = [
        ['payroll_items', 'employee_id', 'employees'],
        ['payroll_items', 'salary_structure_id', 'salary_structures'],
        ['payroll_adjustments', 'created_by', 'employees'],
        ['contractor_claims', 'employee_id', 'employees'],
        ['invoices', 'client_id', 'clients'],
    ];

    public function up(): void
    {
        $this->swap('restrictOnDelete');
    }

    public function down(): void
    {
        $this->swap('cascadeOnDelete');
    }

    private function swap(string $onDelete): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        foreach (self::KEYS as [$table, $column, $parent]) {
            Schema::table($table, function (Blueprint $t) use ($column, $parent, $onDelete) {
                $t->dropForeign([$column]);
                $t->foreign($column)->references('id')->on($parent)->{$onDelete}();
            });
        }
    }
};
