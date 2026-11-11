<?php

namespace App\Domain\Attendance\Actions;

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
            $policy = AttendancePolicy::current();
            $start = $now->copy()->setTimeFromTimeString($policy->shift_start);
            $lateBy = (int) round(($now->getTimestamp() - $start->getTimestamp()) / 60);
            DayState::openWork($employee, $day, $now, null, [
                'first_in_at' => $now,
                'late_minutes' => $lateBy > $policy->grace_minutes ? $lateBy : 0,
            ]);

            return self::STARTED;
        });
    }
}
