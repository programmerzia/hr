<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollItem extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'standard_minutes' => 'integer',
            'worked_minutes' => 'integer',
            'overtime_minutes' => 'integer',
            'unpaid_leave_days' => 'float',
            'late_count' => 'integer',
            'gross' => 'integer',
            'overtime_pay' => 'integer',
            'unpaid_deduction' => 'integer',
            'late_deduction' => 'integer',
            'tax' => 'integer',
            'pf' => 'integer',
            'net' => 'integer',
            'components' => 'array',
            'slices' => 'array',
            'eligible_days' => 'float',
            'absent_days' => 'float',
            'half_days' => 'float',
            'paid_leave_days' => 'float',
            'holiday_days' => 'float',
            'lop_days' => 'float',
            'late_penalty_days' => 'float',
            'day_fraction_total' => 'float',
            'pf_employer' => 'integer',
            'hold' => 'bool',
            'snapshot_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'run_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function salaryStructure(): BelongsTo
    {
        return $this->belongsTo(SalaryStructure::class, 'salary_structure_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }
}
