<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayGrader;
use App\Domain\Attendance\Services\DayState;
use App\Domain\Attendance\Services\Grading;
use App\Domain\Leave\Actions\EndEarly;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\TimeSegment;
use Illuminate\Support\Facades\DB;

class StartWork
{
    public const STARTED = 'started';

    public const RESUMED = 'resumed';

    public const ALREADY_WORKING = 'already_working';

    public const OVERTIME_STARTED = 'overtime_started';

    public const NEEDS_OVERTIME_CONFIRM = 'needs_overtime_confirm';

    public const NEEDS_LEAVE_CONFIRM = 'needs_leave_confirm';

    /** The approved full-day leave covering today, when today is a working day. */
    public static function leaveToday(Employee $employee): ?LeaveRequest
    {
        $date = now()->toDateString();
        $cal = Grading::calendar($employee->id, $date);
        if ($cal['leave_weight'] < 1 || $cal['is_weekend'] || $cal['is_holiday']) {
            return null;
        }

        return LeaveRequest::with('leaveType')->where('employee_id', $employee->id)->where('status', 'approved')->where('half_day', 'none')
            ->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->first();
    }

    public function __invoke(Employee $employee, bool $confirmOvertime = false, bool $confirmLeave = false): string
    {
        return DB::transaction(function () use ($employee, $confirmOvertime, $confirmLeave) {
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
                // Ended before reaching the day's standard hours (signed out with "End my day", or ended by mistake):
                // signing in again simply continues the day. The time in between is a sign-out break.
                $standard = AttendancePolicy::forDate($now->toDateString())->standard_minutes * 60;
                if ((int) $day->work_seconds < $standard) {
                    if ($day->last_out_at && $day->last_out_at->lt($now)) {
                        TimeSegment::create([
                            'attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'signed_out',
                            'started_at' => $day->last_out_at, 'ended_at' => $now, 'note' => 'Ended the day, then continued', 'source' => 'logout',
                        ]);
                    }
                    DayState::openWork($employee, $day, $now, null, ['early_minutes' => 0]);

                    return self::RESUMED;
                }
                if (! $confirmOvertime) {
                    return self::NEEDS_OVERTIME_CONFIRM;
                }
                DayState::openWork($employee, $day, $now, 'Overtime session');

                return self::OVERTIME_STARTED;
            }
            // not_started, on_leave, absent, holiday: first sign-in of the day
            $date = $now->toDateString();
            // Signing in on an approved full-day leave ends the leave from today (after the person confirms).
            $leave = self::leaveToday($employee);
            if ($leave) {
                if (! $confirmLeave) {
                    return self::NEEDS_LEAVE_CONFIRM;
                }
                app(EndEarly::class)($leave, $date);
            }
            // Lateness only means something on a working day: not a weekend, a holiday, or a day off on leave.
            $cal = Grading::calendar($employee->id, $date);
            $offDay = $cal['is_weekend'] || $cal['is_holiday'] || $cal['leave_weight'] >= 1 || Grading::hasFirstHalfLeave($employee->id, $date) || $leave !== null;
            [$late, $halfDay] = $offDay ? [0, false] : DayGrader::late(AttendancePolicy::forDate($date), $date, $now);
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
