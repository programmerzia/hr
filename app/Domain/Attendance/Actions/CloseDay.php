<?php

namespace App\Domain\Attendance\Actions;

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

        $employees = Employee::whereIn('status', ['active', 'probation'])
            ->where('employment_type', '!=', 'contractor')
            ->whereDate('joined_on', '<=', $date)
            ->where(fn ($q) => $q->whereNull('exited_on')->orWhereDate('exited_on', '>=', $date))
            ->get();

        foreach ($employees as $employee) {
            $notify = DB::transaction(fn () => $this->closeOne($employee, $date, $policy));
            if ($notify === false) {
                continue;
            }
            $count++;
            if ($notify) {
                $this->notify($employee, $date, $notify);
            }
        }

        return $count;
    }

    /** @return false|string|null false = already closed; a string = notification reason */
    private function closeOne(Employee $employee, string $date, AttendancePolicy $policy): false|string|null
    {
        $day = AttendanceDay::where('employee_id', $employee->id)->whereDate('date', $date)->lockForUpdate()->first();
        if ($day?->closed_at) {
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
            $end = $this->closeAt($employee, $day, $date, $policy);
            $open = TimeSegment::where('attendance_day_id', $day->id)->whereNull('ended_at')->get();
            foreach ($open as $seg) {
                $seg->update(['ended_at' => $end->max($seg->started_at), 'source' => 'manual', 'note' => 'auto-closed']);
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

        if ($autoClosed) {
            return 'auto_closed';
        }

        return $g['absence_kind'] === 'unapproved' ? 'absent' : null;
    }

    /** min(shift end, last heartbeat, now), never before the open segment started and never past the date's midnight. */
    private function closeAt(Employee $employee, AttendanceDay $day, string $date, AttendancePolicy $policy): CarbonImmutable
    {
        $tz = config('app.timezone');
        $now = CarbonImmutable::now($tz);
        $shiftEnd = CarbonImmutable::parse("{$date} {$policy->shift_end}", $tz);
        $midnight = CarbonImmutable::parse($date, $tz)->endOfDay();
        $seen = User::where('employee_id', $employee->id)->value('last_seen_at');
        $seen = $seen ? CarbonImmutable::parse($seen, $tz) : $now;
        $openStart = $day->openSegment()?->started_at;
        $end = $now->min($seen);
        if (! $openStart || $openStart->lt($shiftEnd)) {
            $end = $end->min($shiftEnd);
        }
        $end = $end->min($midnight);

        return $openStart ? $end->max(CarbonImmutable::instance($openStart)) : $end;
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
