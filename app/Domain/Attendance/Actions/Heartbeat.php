<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Port of session.heartbeat(): reconcileOffline(lastSeen, now) then heartbeat() (an idle break is closed by the next
 * activity), then last_seen_at = now. Returns true when the day changed.
 */
class Heartbeat
{
    public function __invoke(User $user): bool
    {
        $employee = $user->employee;
        if (! $employee) {
            return false;
        }

        return DB::transaction(function () use ($user, $employee) {
            DayState::findForUpdate($employee);
            $now = now();
            $changed = $user->last_seen_at ? $this->reconcileOffline($user, $now) : false;

            $day = DayState::find($employee);
            if ($day?->status === 'on_break') {
                $open = $day->openSegment();
                if ($open?->break_category === 'idle') {
                    DayState::openWork($employee, $day, $now, null);
                    $changed = true;
                }
            }
            $user->forceFill(['last_seen_at' => $now])->save();

            return $changed;
        });
    }

    private function reconcileOffline(User $user, $now): bool
    {
        $employee = $user->employee;
        $idle = AttendancePolicy::current()->idle_timeout_minutes * 60;
        $lastSeen = $user->last_seen_at->copy();
        if ($now->getTimestamp() - $lastSeen->getTimestamp() <= $idle) {
            return false;
        }
        $day = DayState::find($employee);
        if (! $day) {
            return false;
        }
        $open = $day->openSegment();
        if (! $open) {
            return false;
        }
        $convertIdle = false;
        if ($day->status === 'working' && $open->type === 'work') {
            // A heartbeat from before this work segment started says nothing about it.
            if ($open->started_at->gt($lastSeen)) {
                $lastSeen = $open->started_at->copy();
            }
            if ($now->getTimestamp() - $lastSeen->getTimestamp() <= $idle) {
                return false;
            }
        } elseif ($day->status === 'on_break' && $open->break_category === 'idle'
            && $open->started_at->getTimestamp() >= $lastSeen->getTimestamp() - 5) {
            $convertIdle = true;
            $lastSeen = $open->started_at->copy();
        } else {
            // On a break the person chose, or the day is not running: the gap is not extra lost time.
            return false;
        }

        $offline = [
            'type' => 'break',
            'break_category' => 'offline',
            'started_at' => $lastSeen,
            'ended_at' => $now,
            'note' => 'App closed or no connection',
            'source' => 'offline',
        ];
        if ($convertIdle) {
            $open->update($offline);
        } else {
            if ($lastSeen->getTimestamp() <= $open->started_at->getTimestamp()) {
                $open->delete();
            } else {
                $open->update(['ended_at' => $lastSeen]);
            }
            TimeSegment::create(['attendance_day_id' => $day->id, ...$offline]);
        }
        DayState::closeEntries($employee, $lastSeen);
        DayState::openWork($employee, $day, $now, null);

        return true;
    }
}
