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
        return ['weekend_days' => 'array', 'effective_from' => 'date', 'early_counts_as_late' => 'bool', 'idle_by_input' => 'bool'];
    }

    public const DEFAULTS = [
        'shift_start' => '10:00',
        'shift_end' => '19:00',
        'grace_minutes' => 15,
        'standard_minutes' => 480,
        'idle_timeout_minutes' => 10,
        'idle_by_input' => false,
        'offline_after_minutes' => 3,
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

    /**
     * First day of the work week (0 = Sun .. 6 = Sat): the first working day after the weekend, so a Fri+Sat weekend
     * starts the week on Sunday and a Sat+Sun weekend on Monday. Monday when there is no weekend configured.
     */
    public function weekStartsOn(): int
    {
        $weekend = array_map('intval', $this->weekend_days ?? []);
        if ($weekend === [] || count(array_unique($weekend)) >= 7) {
            return 1;
        }
        for ($d = 0; $d < 7; $d++) {
            if (! in_array($d, $weekend, true) && in_array(($d + 6) % 7, $weekend, true)) {
                return $d;
            }
        }

        return 1;
    }

    public static function current(): self
    {
        return once(fn () => static::forDate(now()->toDateString()));
    }
}
