<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Models\Employee;
use App\Models\TimeSegment;
use Illuminate\Support\Facades\DB;

class SetCurrentTask
{
    public function __invoke(Employee $employee, ?string $taskId): void
    {
        DB::transaction(function () use ($employee, $taskId) {
            $now = now();
            $employee->update(['current_task_id' => $taskId]);
            $day = DayState::find($employee);
            if (! $day || $day->status !== 'working') {
                return;
            }
            $open = TimeSegment::where('attendance_day_id', $day->id)->whereNull('ended_at')->where('type', 'work')->first();
            DayState::closeEntries($employee, $now);
            if ($taskId && $open) {
                DayState::openEntry($employee, $open, $taskId, $now);
            }
        });
    }
}
