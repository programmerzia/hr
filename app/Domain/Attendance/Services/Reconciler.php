<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\StartWork;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Brings a person's attendance in line with what the server knows about them, on sign-in and on every heartbeat:
 * closes their own stale past days, records an offline gap, opens an idle break from the last real input, resumes work
 * on fresh input, and carries work past midnight onto the new day. Server time is the source of truth; the client's
 * activity time is only ever used clamped to [open segment start, now].
 */
final class Reconciler
{
    /**
     * @param  bool  $live  false at sign-in: only the stale-day and offline-gap steps run (StartWork does the rest)
     * @return bool whether the day changed
     */
    public function __invoke(User $user, CarbonInterface $now, ?CarbonInterface $activityAt = null, bool $live = true): bool
    {
        $employee = $user->employee;
        if (! $employee) {
            return false;
        }
        $policy = AttendancePolicy::current();
        $idle = $policy->idle_timeout_minutes * 60;
        // With input detection off the client's last input is ignored: being in the app counts as active.
        if (! $policy->idle_by_input) {
            $activityAt = $activityAt ? $now : null;
        }
        $lastSeen = $user->last_seen_at;
        $continuous = $lastSeen && $now->getTimestamp() - $lastSeen->getTimestamp() <= $idle;

        $healed = $this->closeStalePastDays($user, $now);
        $changed = $healed;
        if ($lastSeen && $this->offlineGap($user, $now)) {
            $changed = true;
        }
        if (! $live) {
            return $changed;
        }

        // Work that ran past midnight: the old day was just closed (here or by the nightly run), carry on today.
        if ($continuous && ! DayState::find($employee) && ($healed || $this->yesterdayAutoClosed($user, $now))) {
            app(StartWork::class)($employee);
            $changed = true;
        }
        $day = DayState::find($employee);
        if (! $day) {
            return $changed;
        }
        $open = $day->openSegment();
        $seen = $this->clamp($activityAt ?? $now, $open?->started_at, $now);

        if ($day->status === 'working' && $open?->type === 'work' && $activityAt && $now->getTimestamp() - $seen->getTimestamp() > $idle) {
            DayState::leaveWork($employee, $day, $seen);
            TimeSegment::create([
                'attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'idle',
                'started_at' => $seen, 'note' => 'No activity detected', 'source' => 'idle',
            ]);
            $day->status = 'on_break';
            $day->last_activity_at = $seen;
            DayState::rollup($day, $now);
            $changed = true;
        } elseif ($day->status === 'on_break' && $open?->break_category === 'idle'
            && ($activityAt === null || ($seen->gt($open->started_at) && $now->getTimestamp() - $seen->getTimestamp() <= $idle))) {
            DayState::openWork($employee, $day, $seen, null);
            $changed = true;
        }
        if (in_array($day->status, ['working', 'on_break'], true)) {
            $day->last_activity_at = $day->last_activity_at && $day->last_activity_at->gt($seen) ? $day->last_activity_at : $seen;
            $day->save();
        }

        return $changed;
    }

    private function clamp(CarbonInterface $at, ?CarbonInterface $min, CarbonInterface $max): CarbonInterface
    {
        $at = $at->copy();
        if ($at->gt($max)) {
            return $max->copy();
        }

        return $min && $at->lt($min) ? $min->copy() : $at;
    }

    /** A running day before today (forgot to end it, no cron) is closed exactly as the nightly run would. */
    private function closeStalePastDays(User $user, CarbonInterface $now): bool
    {
        $stale = AttendanceDay::where('employee_id', $user->employee_id)->whereDate('date', '<', $now->toDateString())
            ->whereIn('status', ['working', 'on_break'])->orderBy('date')->get();
        $closer = app(CloseDay::class);
        foreach ($stale as $d) {
            $closer->forEmployee($user->employee, $d->date->format('Y-m-d'));
        }

        return $stale->isNotEmpty();
    }

    private function yesterdayAutoClosed(User $user, CarbonInterface $now): bool
    {
        return AttendanceDay::where('employee_id', $user->employee_id)->whereDate('date', $now->copy()->subDay()->toDateString())->where('auto_closed', true)->exists();
    }

    /** A gap with no heartbeat at all becomes an offline break; an idle break already open stays idle. */
    private function offlineGap(User $user, CarbonInterface $now): bool
    {
        $employee = $user->employee;
        $idle = AttendancePolicy::current()->idle_timeout_minutes * 60;
        $lastSeen = $user->last_seen_at->copy();
        if ($now->getTimestamp() - $lastSeen->getTimestamp() <= $idle) {
            return false;
        }
        $day = DayState::find($employee);
        $open = $day?->openSegment();
        if (! $day || ! $open || $day->status !== 'working' || $open->type !== 'work') {
            return false; // a break the person chose, an idle break, or a day that is not running: no extra lost time
        }
        // A heartbeat from before this work segment started says nothing about it.
        if ($open->started_at->gt($lastSeen)) {
            $lastSeen = $open->started_at->copy();
        }
        if ($now->getTimestamp() - $lastSeen->getTimestamp() <= $idle) {
            return false;
        }
        if ($lastSeen->getTimestamp() <= $open->started_at->getTimestamp()) {
            $open->delete();
        } else {
            $open->update(['ended_at' => $lastSeen]);
        }
        TimeSegment::create([
            'attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'offline',
            'started_at' => $lastSeen, 'ended_at' => $now, 'note' => 'App closed or no connection', 'source' => 'offline',
        ]);
        DayState::closeEntries($employee, $lastSeen);
        DayState::openWork($employee, $day, $now, null);

        return true;
    }
}
