<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Domain\Attendance\Services\Outage;
use App\Domain\Attendance\Services\Reconciler;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Working days whose last heartbeat is older than offline_after_minutes get a break from that beat (offline on return). */
class SweepIdle
{
    public function __invoke(): int
    {
        $now = now();
        $cutoff = $now->copy()->subMinutes(AttendancePolicy::current()->offline_after_minutes);
        $count = 0;
        $days = AttendanceDay::with('employee')->whereDate('date', $now->toDateString())->where('status', 'working')->get();
        // Nobody reached the server lately although several are working: our outage, not theirs. The gap is settled
        // (outage = work) when their heartbeats come back.
        if (Outage::serverDarkNow($now, $days->count())) {
            return 0;
        }
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
                    'note' => Reconciler::OFFLINE_NOTE,
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
