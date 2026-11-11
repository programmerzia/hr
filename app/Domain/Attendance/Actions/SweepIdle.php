<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Port of the mock idle sweep: working days whose last heartbeat is older than the timeout get an idle break from that beat. */
class SweepIdle
{
    public function __invoke(): int
    {
        $now = now();
        $cutoff = $now->copy()->subMinutes(AttendancePolicy::current()->idle_timeout_minutes);
        $count = 0;
        $days = AttendanceDay::with('employee')->whereDate('date', $now->toDateString())->where('status', 'working')->get();
        foreach ($days as $day) {
            $user = User::where('employee_id', $day->employee_id)->first();
            if (! $user?->last_seen_at || $user->last_seen_at->gt($cutoff)) {
                continue;
            }
            $last = $user->last_seen_at->copy();
            DB::transaction(function () use ($day, $last) {
                DayState::leaveWork($day->employee, $day, $last);
                TimeSegment::create([
                    'attendance_day_id' => $day->id,
                    'type' => 'break',
                    'break_category' => 'idle',
                    'started_at' => $last,
                    'note' => 'No activity detected',
                    'source' => 'idle_sweep',
                ]);
                $day->status = 'on_break';
                DayState::rollup($day, now());
            });
            $count++;
        }

        return $count;
    }
}
