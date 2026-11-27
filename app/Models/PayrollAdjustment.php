<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PayrollAdjustment extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    /** category => [direction, label]. Direction is derived from the category, never typed in. */
    public const CATEGORIES = [
        'bonus' => ['bonus', 'Bonus'],
        'arrears' => ['bonus', 'Arrears'],
        'allowance' => ['bonus', 'Allowance'],
        'reimbursement' => ['bonus', 'Reimbursement'],
        'advance_recovery' => ['deduction', 'Advance recovery'],
        'loan_recovery' => ['deduction', 'Loan recovery'],
        'manual_deduction' => ['deduction', 'Other deduction'],
    ];

    public static function kindOf(string $category): string
    {
        return self::CATEGORIES[$category][0] ?? 'deduction';
    }

    public static function categoryLabel(?string $category): string
    {
        return self::CATEGORIES[$category ?? '']['1'] ?? 'Other';
    }

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(PayrollItem::class, 'item_id');
    }

    public function createdByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'created_by');
    }
}
