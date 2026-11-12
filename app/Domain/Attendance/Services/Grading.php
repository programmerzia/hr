<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\RegularizationRequest;

/** Loads the facts DayGrader needs for a stored day (policy by date, weekend, holiday, approved leave, resolution). */
final class Grading
{
    /** @return array{is_weekend:bool, is_holiday:bool, leave_weight:float, leave_paid:bool} */
    public static function calendar(string $employeeId, string $date): array
    {
        $policy = AttendancePolicy::forDate($date);
        $dow = (int) date('w', strtotime($date));
        $leave = LeaveRequest::with('leaveType')->where('employee_id', $employeeId)->where('status', 'approved')
            ->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->get();
        $weight = 0.0;
        $paid = false;
        foreach ($leave as $r) {
            $w = $r->half_day !== 'none' && $r->starts_on->equalTo($r->ends_on) ? 0.5 : 1.0;
            if ($w > $weight) {
                $weight = $w;
                $paid = (bool) $r->leaveType?->is_paid;
            }
        }

        return [
            'is_weekend' => in_array($dow, array_map('intval', $policy->weekend_days ?? [5, 6]), true),
            'is_holiday' => Holiday::whereDate('date', $date)->exists(),
            'leave_weight' => $weight,
            'leave_paid' => $paid,
        ];
    }

    /** Grades the day and fills day_fraction/absence_kind/late_minutes/early_minutes (does not save). */
    public static function apply(AttendanceDay $day): array
    {
        $date = $day->date->format('Y-m-d');
        $resolution = $day->is_regularized
            ? RegularizationRequest::where('attendance_day_id', $day->id)->where('kind', '!=', 'overtime')->where('status', 'approved')->latest('decided_at')->value('resolution')
            : null;
        $g = DayGrader::grade(AttendancePolicy::forDate($date), [
            'date' => $date,
            ...self::calendar($day->employee_id, $date),
            'first_in_at' => $day->first_in_at,
            'last_out_at' => $day->last_out_at,
            'work_seconds' => (int) $day->work_seconds,
            'is_regularized' => (bool) $day->is_regularized,
            'regularization_resolution' => $resolution,
        ]);
        $day->fill([
            'day_fraction' => $g['day_fraction'],
            'absence_kind' => $g['absence_kind'],
            'late_minutes' => $g['late_minutes'],
            'early_minutes' => $g['early_minutes'],
        ]);

        return $g;
    }
}
