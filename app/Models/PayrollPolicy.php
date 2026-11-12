<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Money rules (docs/07-payroll-plan.md §2). Versioned by effective_from; every deduction is a switch, PF off by default. */
class PayrollPolicy extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    public const DEFAULTS = [
        'effective_from' => '2000-01-01',
        'daily_rate_basis' => 'working_days',
        'lop_enabled' => true,
        'late_penalty_enabled' => false,
        'lates_per_penalty' => 3,
        'penalty_days' => 0.5,
        'max_penalty_days_per_month' => 3,
        'pf_enabled' => false,
        'pf_employee_percent' => 0,
        'pf_employer_percent' => 0,
        'tax_enabled' => true,
        'overtime_enabled' => false,
        'overtime_multiplier' => 1.5,
        'overtime_requires_approval' => true,
        'overtime_min_block_minutes' => 30,
        'overtime_daily_cap_minutes' => 240,
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'lop_enabled' => 'bool', 'late_penalty_enabled' => 'bool', 'pf_enabled' => 'bool',
            'tax_enabled' => 'bool', 'overtime_enabled' => 'bool', 'overtime_requires_approval' => 'bool',
            'penalty_days' => 'float', 'max_penalty_days_per_month' => 'float',
            'pf_employee_percent' => 'float', 'pf_employer_percent' => 'float', 'overtime_multiplier' => 'float',
        ];
    }

    /** Policy in force on a date (latest effective_from <= date); created with defaults when none exists. */
    public static function forDate(string $date): self
    {
        return static::whereDate('effective_from', '<=', $date)->orderByDesc('effective_from')->first()
            ?? static::orderBy('effective_from')->first()
            ?? static::create(self::DEFAULTS);
    }

    public static function current(): self
    {
        return once(fn () => static::forDate(now()->toDateString()));
    }
}
