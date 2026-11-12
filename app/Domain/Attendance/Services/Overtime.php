<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\PayrollPolicy;

/** Raw and approvable overtime for a stored day (docs/07 §2 Overtime). Grading is DayGrader's. */
final class Overtime
{
    /** True when the payroll policy in force on the date pays overtime only once a lead/HR approved the minutes. */
    public static function needsApproval(string $date): bool
    {
        $p = PayrollPolicy::forDate($date);

        return (bool) $p->overtime_enabled && (bool) $p->overtime_requires_approval;
    }

    /** Minutes worked beyond the standard day (all work on weekends/holidays). @param array<string,mixed>|null $calendar */
    public static function raw(AttendanceDay $day, ?array $calendar = null): int
    {
        $date = $day->date->format('Y-m-d');

        return DayGrader::grade(AttendancePolicy::forDate($date), [
            'date' => $date,
            ...($calendar ?? Grading::calendar($day->employee_id, $date)),
            'first_in_at' => $day->first_in_at,
            'last_out_at' => $day->last_out_at,
            'work_seconds' => (int) $day->work_seconds,
        ])['overtime_minutes'];
    }
}
