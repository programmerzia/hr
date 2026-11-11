<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\TaskTimeEntry;
use App\Models\TimeSegment;
use Carbon\CarbonInterface;

/** Shared segment bookkeeping used by the attendance actions (mirrors the mock store's private helpers). */
final class DayState
{
    public static function find(Employee $employee, ?CarbonInterface $at = null): ?AttendanceDay
    {
        return AttendanceDay::where('employee_id', $employee->id)
            ->whereDate('date', ($at ?? now())->toDateString())
            ->first();
    }

    public static function ensureToday(Employee $employee): AttendanceDay
    {
        return self::find($employee) ?? AttendanceDay::create([
            'employee_id' => $employee->id,
            'date' => now()->toDateString(),
            'status' => 'not_started',
        ]);
    }

    public static function closeOpen(AttendanceDay $day, CarbonInterface $at): void
    {
        TimeSegment::where('attendance_day_id', $day->id)->whereNull('ended_at')->update(['ended_at' => $at]);
    }

    public static function closeEntries(Employee $employee, CarbonInterface $at): void
    {
        TaskTimeEntry::where('employee_id', $employee->id)->whereNull('ended_at')->get()
            ->each(fn (TaskTimeEntry $e) => $e->update([
                'ended_at' => $at,
                'seconds' => max(0, $at->getTimestamp() - $e->started_at->getTimestamp()),
            ]));
    }

    public static function openEntry(Employee $employee, TimeSegment $seg, string $taskId, CarbonInterface $at): void
    {
        TaskTimeEntry::create([
            'time_segment_id' => $seg->id,
            'task_id' => $taskId,
            'employee_id' => $employee->id,
            'started_at' => $at,
            'seconds' => 0,
        ]);
    }

    /** Closes whatever is open and opens a work segment (plus a task entry when a task is selected). */
    public static function openWork(Employee $employee, AttendanceDay $day, CarbonInterface $at, ?string $note, array $patch = []): TimeSegment
    {
        self::closeOpen($day, $at);
        $seg = TimeSegment::create([
            'attendance_day_id' => $day->id,
            'type' => 'work',
            'break_category' => null,
            'started_at' => $at,
            'note' => $note,
            'source' => 'login',
        ]);
        if ($employee->current_task_id) {
            self::openEntry($employee, $seg, $employee->current_task_id, $at);
        }
        $day->fill(['status' => 'working', 'last_out_at' => null, ...$patch]);
        self::rollup($day, $at);

        return $seg;
    }

    public static function leaveWork(Employee $employee, AttendanceDay $day, CarbonInterface $at): void
    {
        self::closeEntries($employee, $at);
        self::closeOpen($day, $at);
    }

    /** Refreshes the cached seconds (break = chosen + idle + offline, as endDay in the mock) and saves. */
    public static function rollup(AttendanceDay $day, CarbonInterface $at): void
    {
        $t = DayCalculator::totals($day->segments()->get(), $at, AttendancePolicy::current()->lunch_cap_minutes);
        $day->work_seconds = $t['work_seconds'];
        $day->break_seconds = $t['break_seconds'] + $t['idle_seconds'] + $t['offline_seconds'];
        $day->save();
    }
}
