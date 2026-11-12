<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One row per approved payroll item with PF (docs/07 §3); cumulative totals per employee. */
class PfLedger extends Model
{
    use HasUuids;

    protected $table = 'pf_ledger';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'year' => 'integer', 'month' => 'integer', 'employee_amount' => 'integer', 'employer_amount' => 'integer',
            'cumulative_employee' => 'integer', 'cumulative_employer' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'item_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
