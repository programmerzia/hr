<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\Grading;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Re-grades an employee's attendance days in [from, to] after the facts behind them changed (leave approved or
 * cancelled, holiday added/removed, regularization). See docs/09 C1. Returns the number of rows re-graded.
 *
 * Only days before today are touched: a closed or ended row is graded again from the current facts, a missing past row
 * is created the way the nightly close would (without notifying anyone). Rows still running are left to the close.
 */
class RegradeDays
{
    public function __invoke(string $employeeId, string $from, string $to): int
    {
        $employee = Employee::find($employeeId);
        if (! $employee) {
            return 0;
        }
        $last = min($to, now()->subDay()->toDateString());
        $count = 0;
        for ($d = CarbonImmutable::parse($from)->startOfDay(); $d->toDateString() <= $last; $d = $d->addDay()) {
            $count += DB::transaction(fn () => $this->regrade($employee, $d->toDateString())) ? 1 : 0;
        }

        return $count;
    }

    /** Every employee, for one date (holiday added or removed). */
    public function forDate(string $date): int
    {
        $n = 0;
        foreach (Employee::pluck('id') as $id) {
            $n += $this($id, $date, $date);
        }

        return $n;
    }

    private function regrade(Employee $employee, string $date): bool
    {
        $day = AttendanceDay::where('employee_id', $employee->id)->whereDate('date', $date)->lockForUpdate()->first();
        if (! $day) {
            if ($employee->employment_type === 'contractor' || $employee->joined_on?->toDateString() > $date
                || ($employee->exited_on && $employee->exited_on->toDateString() < $date)) {
                return false;
            }
            $closer = app(CloseDay::class);

            return $closer->closeOne($employee, $date, AttendancePolicy::forDate($date)) !== false;
        }
        if (! $day->closed_at && $day->status !== 'ended') {
            return false; // still running or not yet closed: the close will grade it
        }
        if (in_array($day->status, ['absent', 'on_leave', 'holiday', 'not_started'], true) && ! $day->first_in_at && (int) $day->work_seconds === 0) {
            $cal = Grading::calendar($employee->id, $date);
            $day->status = $cal['is_weekend'] || $cal['is_holiday'] ? 'holiday' : ($cal['leave_weight'] >= 1 ? 'on_leave' : 'absent');
        }
        Grading::apply($day);
        $day->save();

        return true;
    }
}
