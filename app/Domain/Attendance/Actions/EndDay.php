<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Models\Employee;
use Illuminate\Support\Facades\DB;

class EndDay
{
    public function __invoke(Employee $employee): bool
    {
        return DB::transaction(function () use ($employee) {
            $day = DayState::findForUpdate($employee);
            if (! $day || ! in_array($day->status, ['working', 'on_break'], true)) {
                return false;
            }
            $now = now();
            DayState::leaveWork($employee, $day, $now);
            $day->status = 'ended';
            $day->last_out_at = $now;
            DayState::rollup($day, $now);

            return true;
        });
    }
}
