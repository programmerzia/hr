<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\CloseTime;
use App\Domain\Attendance\Services\DayCalculator;
use App\Domain\Attendance\Services\DayState;
use App\Domain\Attendance\Services\Grading;
use App\Domain\Attendance\Support\AttendanceNotification;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Nightly day close (attendance:close-day, 00:10). For every employee expected at work on the date: create the
 * missing row (absent / holiday / on_leave), auto-close a forgotten running day, grade it and stamp closed_at.
 * Idempotent: rows with closed_at are left alone. Returns the number of rows closed.
 */
class CloseDay
{
    public function __invoke(?string $date = null): int
    {
        $date ??= now()->subDay()->toDateString();
        $policy = AttendancePolicy::forDate($date);
        $count = 0;

        // Contractors are included only so a running day of theirs gets closed; no rows are created for them.
        $employees = Employee::whereIn('status', ['active', 'probation'])
            ->whereDate('joined_on', '<=', $date)
            ->where(fn ($q) => $q->whereNull('exited_on')->orWhereDate('exited_on', '>=', $date))
            ->get();

        foreach ($employees as $employee) {
            if ($this->forEmployee($employee, $date, $policy) !== false) {
                $count++;
            }
        }

        return $count;
    }

    /** Closes one employee's day (notifying as the nightly run does). False when nothing needed closing. */
    public function forEmployee(Employee $employee, string $date, ?AttendancePolicy $policy = null): bool
    {
        $notify = DB::transaction(fn () => $this->closeOne($employee, $date, $policy ?? AttendancePolicy::forDate($date)));
        if ($notify === false) {
            return false;
        }
        if ($notify) {
            $this->notify($employee, $date, $notify);
        }

        return true;
    }

    /** @return false|string|null false = already closed; a string = notification reason */
    public function closeOne(Employee $employee, string $date, AttendancePolicy $policy): false|string|null
    {
        $day = AttendanceDay::where('employee_id', $employee->id)->whereDate('date', $date)->lockForUpdate()->first();
        if ($day?->closed_at) {
            return false;
        }
        if ($employee->employment_type === 'contractor' && ! in_array($day?->status, ['working', 'on_break'], true)) {
            return false;
        }
        $cal = Grading::calendar($employee->id, $date);
        if (! $day) {
            $day = AttendanceDay::create([
                'employee_id' => $employee->id,
                'date' => $date,
                'status' => $cal['is_weekend'] || $cal['is_holiday'] ? 'holiday' : ($cal['leave_weight'] >= 1 ? 'on_leave' : 'absent'),
            ]);
        }

        $autoClosed = false;
        if (in_array($day->status, ['working', 'on_break'], true)) {
            $end = $this->closeAt($day, $date, $policy);
            $open = TimeSegment::where('attendance_day_id', $day->id)->whereNull('ended_at')->get();
            foreach ($open as $seg) {
                $seg->update(['ended_at' => $end->max($seg->started_at), 'note' => 'auto-closed']);
            }
            DayState::closeEntries($employee, $end);
            $t = DayCalculator::totals($day->segments()->get(), $end, $policy->lunch_cap_minutes);
            $day->fill([
                'status' => 'ended',
                'last_out_at' => $end,
                'auto_closed' => true,
                'work_seconds' => $t['work_seconds'],
                'break_seconds' => $t['break_seconds'] + $t['idle_seconds'] + $t['offline_seconds'],
            ]);
            $autoClosed = true;
        } elseif ($day->status === 'not_started') {
            $day->status = $cal['is_weekend'] || $cal['is_holiday'] ? 'holiday' : ($cal['leave_weight'] >= 1 ? 'on_leave' : 'absent');
        }

        $g = Grading::apply($day);
        $day->closed_at = now();
        $day->save();

        $workingDay = ! $cal['is_weekend'] && ! $cal['is_holiday'] && $cal['leave_weight'] < 1;
        if ($autoClosed) {
            return $workingDay ? 'auto_closed' : null;
        }
        if ($employee->employment_type === 'contractor') {
            return null;
        }

        return $g['absence_kind'] === 'unapproved' ? 'absent' : null;
    }

    private function closeAt(AttendanceDay $day, string $date, AttendancePolicy $policy): CarbonImmutable
    {
        return CloseTime::at($date, $day->openSegment()?->started_at, $day->last_activity_at, $policy, null, CloseTime::legacySeen($day));
    }

    private function notify(Employee $employee, string $date, string $reason): void
    {
        $label = CarbonImmutable::parse($date)->format('D, M j');
        [$mine, $theirs] = $reason === 'auto_closed'
            ? ["Your day on {$label} was closed automatically", "{$employee->name}'s day on {$label} was closed automatically"]
            : ["You were marked absent on {$label}", "{$employee->name} was marked absent on {$label}"];
        $body = 'Request a regularisation from My day if this is wrong.';
        User::where('employee_id', $employee->id)->first()?->notify(new AttendanceNotification($mine, $body, '/my-day'));
        $lead = LeaveNotifier::leadOf($employee);
        if ($lead) {
            User::where('employee_id', $lead->id)->first()?->notify(new AttendanceNotification($theirs, null, '/team/history'));
        }
    }
}
