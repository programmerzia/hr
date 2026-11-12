<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayGrader;
use App\Domain\Attendance\Services\DayState;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use Illuminate\Support\Facades\DB;

class StartWork
{
    public const STARTED = 'started';

    public const RESUMED = 'resumed';

    public const ALREADY_WORKING = 'already_working';

    public const OVERTIME_STARTED = 'overtime_started';

    public const NEEDS_OVERTIME_CONFIRM = 'needs_overtime_confirm';

    public function __invoke(Employee $employee, bool $confirmOvertime = false): string
    {
        return DB::transaction(function () use ($employee, $confirmOvertime) {
            $day = DayState::ensureToday($employee);
            $now = now();
            if ($day->status === 'working') {
                return self::ALREADY_WORKING;
            }
            if ($day->status === 'on_break') {
                DayState::openWork($employee, $day, $now, null);

                return self::RESUMED;
            }
            if ($day->status === 'ended') {
                if (! $confirmOvertime) {
                    return self::NEEDS_OVERTIME_CONFIRM;
                }
                DayState::openWork($employee, $day, $now, 'Overtime session');

                return self::OVERTIME_STARTED;
            }
            // not_started, on_leave, absent, holiday: first sign-in of the day
            $date = $now->toDateString();
            [$late, $halfDay] = DayGrader::late(AttendancePolicy::forDate($date), $date, $now);
            DayState::openWork($employee, $day, $now, null, [
                'first_in_at' => $now,
                'late_minutes' => $late,
                // Login past the half-day threshold: the day counts as half unless regularised (re-graded at end of day).
                ...($halfDay ? ['day_fraction' => 0.5, 'absence_kind' => 'half_day'] : []),
            ]);

            return self::STARTED;
        });
    }
}
