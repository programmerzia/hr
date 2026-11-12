<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalaryStructure extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['effective_from' => 'date', 'pf_percent' => 'float', 'pf_employer_percent' => 'float', 'other_allowances' => 'array'];
    }

    /** @return list<array{label:string,amount:int}> */
    public function otherAllowances(): array
    {
        return array_values(array_map(fn ($a) => ['label' => (string) ($a['label'] ?? 'Other'), 'amount' => (int) ($a['amount'] ?? 0)], $this->other_allowances ?? []));
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
