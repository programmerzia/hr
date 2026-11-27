<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\StartWork;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Brings a person's attendance in line with what the server knows about them, on sign-in and on every heartbeat:
 * closes their own stale past days, records an offline gap, opens an idle break from the last real input, resumes work
 * on fresh input, and carries work past midnight onto the new day. Server time is the source of truth; the client's
 * activity time is only ever used clamped to [open segment start, now].
 */
final class Reconciler
{
    /** What the client saw while it sent no heartbeats (gap_reason) and the note the offline break gets. */
    public const GAP_NOTES = [
        'no_internet' => 'No internet connection',
        'unreachable' => 'Could not reach the server (network problem)',
        'asleep' => 'Device asleep or locked',
        'suspended' => 'Browser paused the HR tab',
        'closed' => 'HR app closed',
    ];

    /** No heartbeat and nothing from the client about why (old client, or the tab never came back). */
    public const NO_SIGNAL_NOTE = 'No signal from the HR app';

    /** Kept for the sweep and old rows: a break opened while we do not yet know why the beats stopped. */
    public const OFFLINE_NOTE = self::NO_SIGNAL_NOTE;

    /** How far past the last beat the client's own gap start is trusted (one beat plus scheduling slack). */
    public const SINCE_SLACK = 90;

    public const OUTAGE_NOTE = 'Server unreachable for everyone, counted as work';

    /** The idle break opened when nobody has touched the app after shift end (presence counts only during the shift). */
    public const AFTER_HOURS_NOTE = 'No input after shift end';

    /** Hours before shift start from which an open tab already counts as work. */
    public const PRESENCE_EARLY_HOURS = 3;

    /**
     * @param  bool  $live  false at sign-in: only the stale-day and offline-gap steps run (StartWork does the rest)
     * @param  ?CarbonInterface  $activityAt  the client's last real input; null (older clients) means "active now"
     * @return bool whether the day changed
     */
    public function __invoke(User $user, CarbonInterface $now, ?CarbonInterface $activityAt = null, bool $live = true, ?string $gapReason = null, ?CarbonInterface $gapSince = null): bool
    {
        $employee = $user->employee;
        if (! $employee) {
            return false;
        }
        $policy = AttendancePolicy::current();
        $idle = $policy->idle_timeout_minutes * 60;
        $lastSeen = $user->last_seen_at;
        $continuous = $lastSeen && $now->getTimestamp() - $lastSeen->getTimestamp() <= $policy->offline_after_minutes * 60;
        // Real input in the last idle timeout (old clients send none: taken as input now).
        $input = $activityAt ? ($activityAt->gt($now) ? $now->copy() : $activityAt->copy()) : $now->copy();
        $hasInput = $now->getTimestamp() - $input->getTimestamp() <= $idle;

        // Beats stopped and came back with no cause seen by the client, while its last input is from before the gap:
        // the page was not reloaded (that resets the input clock), so the browser paused the tab in the background.
        if ($gapReason === null && $activityAt && $lastSeen && ! $continuous && $activityAt->lte($lastSeen)) {
            $gapReason = 'suspended';
        }

        $healed = $this->closeStalePastDays($user, $now);
        $changed = $healed;
        if ($lastSeen && $this->offlineGap($user, $now, $gapReason, $gapSince)) {
            $changed = true;
        }
        if (! $live) {
            return $changed;
        }

        // Work that ran up to midnight: the old day was just closed (here or by the nightly run), carry on today. Only
        // on real input: a tab left open overnight never starts the next day by itself.
        if ($continuous && $hasInput && ! DayState::find($employee) && ($healed || $this->yesterdayAutoClosed($user, $now)) && $this->ranToMidnight($user, $now, $idle)) {
            app(StartWork::class)($employee, at: $input->max($now->copy()->startOfDay()));
            $changed = true;
        }
        $day = DayState::find($employee);
        if (! $day) {
            return $changed;
        }
        $open = $day->openSegment();
        $shiftStart = $now->copy()->setTimeFromTimeString($policy->shift_start);
        $shiftEnd = $now->copy()->setTimeFromTimeString($policy->shift_end);
        // Presence model (idle by input off): during the shift an open tab counts as work. Outside it only input does;
        // after shift end the presence-credited time up to shift end is kept. Early starters get presence from up to
        // PRESENCE_EARLY_HOURS before shift start, so reading a document at 08:30 isn't idle; the night stays input-only.
        $presence = ! $policy->idle_by_input && $now->gte($shiftStart->copy()->subHours(self::PRESENCE_EARLY_HOURS)) && $now->lte($shiftEnd);
        $checkIdle = $activityAt !== null && ! $presence;
        // Several tabs: the most recent input any of them reported counts, not just this one's (docs P1-3).
        $latest = $day->last_activity_at && $day->last_activity_at->gt($input) && $day->last_activity_at->lte($now) ? $day->last_activity_at->copy() : $input;
        if (! $policy->idle_by_input && $now->gt($shiftEnd) && $latest->lt($shiftEnd)) {
            $latest = $shiftEnd->copy();
        }
        $seen = $presence || $activityAt === null ? $now->copy() : $this->clamp($latest, $open?->started_at, $now);

        if ($day->status === 'working' && $open?->type === 'work' && $checkIdle && $now->getTimestamp() - $seen->getTimestamp() > $idle) {
            DayState::leaveWork($employee, $day, $seen);
            TimeSegment::create([
                'attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'idle', 'started_at' => $seen,
                'note' => $policy->idle_by_input ? 'No keyboard or mouse input' : self::AFTER_HOURS_NOTE, 'source' => 'idle',
            ]);
            $day->status = 'on_break';
            $day->last_activity_at = $seen;
            DayState::rollup($day, $now);
            $changed = true;
        } elseif ($day->status === 'on_break' && $open?->break_category === 'idle') {
            // Input resumes work from when it happened; presence alone never ends an idle break.
            $back = $this->clamp($latest, $open->started_at, $now);
            if ($activityAt === null || ($back->gt($open->started_at) && $now->getTimestamp() - $back->getTimestamp() <= $idle)) {
                DayState::openWork($employee, $day, $activityAt === null ? $now : $back, null);
                $changed = true;
            }
            $seen = $day->status === 'working' ? ($activityAt === null ? $now->copy() : $back) : $open->started_at->copy();
        }
        if (in_array($day->status, ['working', 'on_break'], true)) {
            $day->last_activity_at = $day->last_activity_at && $day->last_activity_at->gt($seen) ? $day->last_activity_at : $seen;
            $day->save();
        }

        return $changed;
    }

    /** Yesterday's work ran up to (within one idle timeout of) midnight, so a beat just after it continues the work. */
    private function ranToMidnight(User $user, CarbonInterface $now, int $idle): bool
    {
        $out = AttendanceDay::where('employee_id', $user->employee_id)->whereDate('date', $now->copy()->subDay()->toDateString())->value('last_out_at');

        return $out && $now->copy()->startOfDay()->getTimestamp() - CarbonImmutable::parse($out, config('app.timezone'))->getTimestamp() <= $idle + 60;
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
        $closed = false;
        foreach ($stale as $d) {
            // A day in a month whose payroll is locked is left as it is (CloseDay refuses it).
            $closed = $closer->forEmployee($user->employee, $d->date->format('Y-m-d')) || $closed;
        }

        return $closed;
    }

    private function yesterdayAutoClosed(User $user, CarbonInterface $now): bool
    {
        return AttendanceDay::where('employee_id', $user->employee_id)->whereDate('date', $now->copy()->subDay()->toDateString())->where('auto_closed', true)->exists();
    }

    /**
     * A gap between heartbeats longer than offline_after_minutes becomes an offline break from the last beat to now,
     * noted with what the client saw ($reason, see GAP_NOTES), except stretches in which the server heard from nobody
     * (its own outage: counted as work). $since is the client's own time for the start of the gap; it is trusted only
     * up to SINCE_SLACK seconds after the last beat (one missed beat), so a client can never stretch work further.
     */
    private function offlineGap(User $user, CarbonInterface $now, ?string $reason = null, ?CarbonInterface $since = null): bool
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
            $open->update(['ended_at' => $from]);
        } else {
            return false; // a break the person chose, an input-idle break, or a day that is not running: no extra lost time
        }

        // The client knows when it actually went quiet (within one beat of the last one): end the work there.
        if ($since && $since->gt($from) && $since->getTimestamp() - $from->getTimestamp() <= self::SINCE_SLACK && $since->lt($now)) {
            TimeSegment::where('attendance_day_id', $day->id)->where('type', 'work')->where('ended_at', $from)->update(['ended_at' => $since]);
            $from = $since->copy();
        }
        $this->fillGap($user, $day, $from, $now, $reason, $limit);
        DayState::closeEntries($employee, $from);
        DayState::openWork($employee, $day, $now, null);
        DayState::tidy($day);

        return true;
    }

    /** Writes the closed segments for ($from, $now): offline with the reason's note, work for the server's own outage. */
    private function fillGap(User $user, AttendanceDay $day, CarbonInterface $from, CarbonInterface $now, ?string $reason, int $limit): void
    {
        $pieces = [];
        $at = $from->copy();
        // The device itself reported being offline: that is never the server's outage.
        $windows = $reason === 'no_internet' ? [] : Outage::darkWindows($user->id, $from, $now);
        foreach ($windows as [$a, $b]) {
            // Silence shorter than the threshold next to an outage is part of it (it would never be offline alone).
            if ($a->getTimestamp() - $at->getTimestamp() < $limit && $pieces === []) {
                $a = $at->copy();
            }
            $pieces[] = ['offline', $at, $a];
            $pieces[] = ['work', $a, $b];
            $at = $b;
        }
        if ($pieces !== [] && $now->getTimestamp() - $at->getTimestamp() < $limit) {
            $pieces[count($pieces) - 1][2] = $now->copy();
            $at = $now->copy();
        }
        $pieces[] = ['offline', $at, $now];
        $note = self::GAP_NOTES[$reason] ?? self::NO_SIGNAL_NOTE;
        foreach ($pieces as $p) {
            if ($p[2]->getTimestamp() <= $p[1]->getTimestamp()) {
                continue;
            }
            TimeSegment::create($p[0] === 'work'
                ? ['attendance_day_id' => $day->id, 'type' => 'work', 'started_at' => $p[1], 'ended_at' => $p[2],
                    'source' => 'outage', 'note' => self::OUTAGE_NOTE]
                : ['attendance_day_id' => $day->id, 'type' => 'break', 'break_category' => 'offline',
                    'started_at' => $p[1], 'ended_at' => $p[2], 'note' => $note, 'source' => 'offline']);
        }
    }
}
