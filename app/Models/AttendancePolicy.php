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
        return ['late_penalty_rule' => 'array', 'weekend_days' => 'array'];
    }

    public const DEFAULTS = [
        'shift_start' => '10:00',
        'shift_end' => '19:00',
        'grace_minutes' => 15,
        'standard_minutes' => 480,
        'idle_timeout_minutes' => 10,
        'lunch_cap_minutes' => 60,
        'late_penalty_rule' => ['lates_per_penalty' => 3, 'penalty_days' => 0.5],
        'weekend_days' => [5, 6],
    ];

    /** Singleton row; created with defaults when missing. */
    public static function current(): self
    {
        return once(fn () => static::query()->first() ?? static::create(self::DEFAULTS));
    }
}
