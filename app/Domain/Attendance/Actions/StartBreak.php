<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Models\Employee;
use App\Models\TimeSegment;
use Illuminate\Support\Facades\DB;

class StartBreak
{
    public function __invoke(Employee $employee, string $category, ?string $note = null): bool
    {
        return DB::transaction(function () use ($employee, $category, $note) {
            $day = DayState::findForUpdate($employee);
            if (! $day || $day->status !== 'working') {
                return false;
            }
            $now = now();
            DayState::leaveWork($employee, $day, $now);
            TimeSegment::create([
                'attendance_day_id' => $day->id,
                'type' => 'break',
                'break_category' => $category,
                'started_at' => $now,
                'note' => $note !== null && trim($note) !== '' ? trim($note) : null,
                'source' => 'logout',
            ]);
            $day->status = 'on_break';
            DayState::rollup($day, $now);

            return true;
        });
    }
}
