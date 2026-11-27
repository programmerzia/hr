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

/**
 * Runs every minute (attendance:sweep). Records that the server is alive (server_ticks, see Outage), then gives
 * working days whose last heartbeat is older than offline_after_minutes a break from that beat (offline on return).
 */
class SweepIdle
{
    public function __invoke(): int
    {
        $now = now();
        // First run after the server itself was down: nobody could reach us. Wait for heartbeats to come back; the
        // gap is settled (outage = work) when they do.
        $wasDark = Outage::serverWasDark($now);
        Outage::serverTick($now);
        if ($wasDark) {
            return 0;
        }
        $cutoff = $now->copy()->subMinutes(AttendancePolicy::current()->offline_after_minutes);
        $count = 0;
        $ids = AttendanceDay::whereDate('date', $now->toDateString())->where('status', 'working')->pluck('id');
        foreach ($ids as $id) {
            $count += DB::transaction(function () use ($id, $cutoff) {
                // A heartbeat may have landed since the list was read: re-check both under the row lock.
                $day = AttendanceDay::with('employee')->lockForUpdate()->find($id);
                if (! $day || $day->status !== 'working') {
                    return 0;
                }
                $user = User::where('employee_id', $day->employee_id)->first();
                if (! $user?->last_seen_at || $user->last_seen_at->gt($cutoff)) {
                    return 0;
                }
                $last = $user->last_seen_at->copy();
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

                return 1;
            });
        }

        return $count;
    }
}
