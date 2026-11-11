<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LeaveType extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'annual_quota' => 'float',
            'is_paid' => 'boolean',
            'carry_forward' => 'boolean',
            'allows_half_day' => 'boolean',
        ];
    }
}
