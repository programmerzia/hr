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
    public const OFFLINE_NOTE = 'App closed, device asleep or no connection';

    public const OUTAGE_NOTE = 'Server unreachable for everyone, counted as work';

    /**
     * @param  bool  $live  false at sign-in: only the stale-day and offline-gap steps run (StartWork does the rest)
     * @return bool whether the day changed
     */
    public function __invoke(User $user, CarbonInterface $now, ?CarbonInterface $activityAt = null, bool $live = true, ?CarbonInterface $offlineSince = null): bool
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
        $continuous = $lastSeen && $now->getTimestamp() - $lastSeen->getTimestamp() <= $policy->offline_after_minutes * 60;

        $healed = $this->closeStalePastDays($user, $now);
        $changed = $healed;
        if ($lastSeen && $this->offlineGap($user, $now, $offlineSince)) {
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
                'started_at' => $seen, 'note' => 'No keyboard or mouse input', 'source' => 'idle',
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

    /**
     * A gap between heartbeats longer than offline_after_minutes becomes offline from the last beat, except stretches in
     * which the server heard from nobody (its own outage: counted as work). $offlineSince is the client's own record
     * of losing the connection; it may only move the start later, by at most the threshold after the last beat.
     */
    private function offlineGap(User $user, CarbonInterface $now, ?CarbonInterface $offlineSince = null): bool
    {
        $employee = $user->employee;
        $limit = AttendancePolicy::current()->offline_after_minutes * 60;
        $lastSeen = $user->last_seen_at->copy();
        if ($now->getTimestamp() - $lastSeen->getTimestamp() <= $limit) {
            return false;
        }
        $day = DayState::find($employee);
        $open = $day?->openSegment();
        if ($day && $open && $day->status === 'on_break' && $open->break_category === 'idle' && $open->source === 'idle_sweep') {
            // The sweep saw no heartbeat at all: on return that time is offline, not idle at the desk.
            $from = $open->started_at->copy();
            $open->delete();
        } elseif ($day && $open && $day->status === 'working' && $open->type === 'work') {
            // A heartbeat from before this work segment started says nothing about it.
            $from = $open->started_at->gt($lastSeen) ? $open->started_at->copy() : $lastSeen;
            if ($now->getTimestamp() - $from->getTimestamp() <= $limit) {
                return false;
            }
            if ($from->getTimestamp() <= $open->started_at->getTimestamp()) {
                $open->delete();
            } else {
                $open->update(['ended_at' => $from]);
            }
        } else {
            return false; // a break the person chose, an input-idle break, or a day that is not running: no extra lost time
        }

        $this->fillGap($user, $day, $from, $now, $offlineSince, $limit);
        DayState::closeEntries($employee, $from);
        DayState::openWork($employee, $day, $now, null);

        return true;
    }

    /** Writes the closed segments for ($from, $now): offline, with work for a server outage or before the client dropped. */
    private function fillGap(User $user, AttendanceDay $day, CarbonInterface $from, CarbonInterface $now, ?CarbonInterface $offlineSince, int $limit): void
    {
        $pieces = [];
        if ($offlineSince && $offlineSince->gt($from) && $offlineSince->lt($now)) {
            $cut = $offlineSince->getTimestamp() - $from->getTimestamp() > $limit ? $from->copy()->addSeconds($limit) : $offlineSince->copy();
            $pieces = [['work', $from, $cut, 'login'], ['offline', $cut, $now]];
        } else {
            $at = $from->copy();
            foreach (Outage::darkWindows($user->id, $from, $now) as [$a, $b]) {
                // Silence shorter than the threshold next to an outage is part of it (it would never be offline alone).
                if ($a->getTimestamp() - $at->getTimestamp() < $limit && $pieces === []) {
                    $a = $at->copy();
                }
                $pieces[] = ['offline', $at, $a];
                $pieces[] = ['work', $a, $b, 'outage'];
                $at = $b;
            }
            if ($pieces !== [] && $now->getTimestamp() - $at->getTimestamp() < $limit) {
                $pieces[count($pieces) - 1][2] = $now->copy();
                $at = $now->copy();
            }
            $pieces[] = ['offline', $at, $now];
        }
        foreach ($pieces as $p) {
            if ($p[2]->getTimestamp() <= $p[1]->getTimestamp()) {
                continue;
            }
            TimeSegment::create($p[0] === 'work'
                ? ['attendance_day_id' => $day->id, 'type' => 'work', 'started_at' => $p[1], 'ended_at' => $p[2],
                    'source' => $p[3], 'note' => $p[3] === 'outage' ? self::OUTAGE_NOTE : null]
                : ['attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'offline',
                    'started_at' => $p[1], 'ended_at' => $p[2], 'note' => self::OFFLINE_NOTE, 'source' => 'offline']);
        }
    }
}
