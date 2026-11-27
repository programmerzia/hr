<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use Carbon\CarbonInterface;

/**
 * Whether the app should ask "Start your day?" on the person's first input: they are signed in (a remembered session
 * skips the sign-in that normally starts the day), today is a working day for them, it is not past shift end, and
 * nothing has been started yet. The app only asks; work never starts without the person saying so.
 */
final class StartPrompt
{
    public static function due(?Employee $employee, ?AttendanceDay $day, CarbonInterface $now): bool
    {
        if (! $employee || ($day && $day->status !== 'not_started')) {
            return false;
        }
        $policy = AttendancePolicy::current();
        if ($now->gt($now->copy()->setTimeFromTimeString($policy->shift_end))) {
            return false;
        }
        $cal = Grading::calendar($employee->id, $now->toDateString());

        return ! $cal['is_weekend'] && ! $cal['is_holiday'] && $cal['leave_weight'] < 1;
    }
}
