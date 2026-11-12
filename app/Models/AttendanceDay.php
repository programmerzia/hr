<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttendanceDay extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'date' => 'date', 'first_in_at' => 'datetime', 'last_out_at' => 'datetime', 'is_regularized' => 'boolean',
            'day_fraction' => 'float', 'auto_closed' => 'boolean', 'closed_at' => 'datetime', 'approved_overtime_minutes' => 'integer',
        ];
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function segments()
    {
        return $this->hasMany(TimeSegment::class)->orderBy('started_at');
    }

    public function openSegment(): ?TimeSegment
    {
        return $this->segments()->whereNull('ended_at')->latest('started_at')->first();
    }
}
