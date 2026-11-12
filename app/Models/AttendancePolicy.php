<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AttendancePolicy extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['weekend_days' => 'array', 'effective_from' => 'date', 'early_counts_as_late' => 'bool'];
    }

    public const DEFAULTS = [
        'shift_start' => '10:00',
        'shift_end' => '19:00',
        'grace_minutes' => 15,
        'standard_minutes' => 480,
        'idle_timeout_minutes' => 10,
        'lunch_cap_minutes' => 60,
        'effective_from' => '2000-01-01',
        'half_day_after_minutes' => 120,
        'early_leave_grace_minutes' => 30,
        'early_counts_as_late' => true,
        'half_day_min_minutes' => 240,
        'absent_below_minutes' => 60,
        'weekend_days' => [5, 6],
    ];

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
