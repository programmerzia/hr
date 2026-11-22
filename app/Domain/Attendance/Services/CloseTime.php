<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * When a day left running is deemed to have ended: its last recorded activity (or, without one, shift end/open start),
 * capped at midnight, never before the open segment began and never in the future.
 */
final class CloseTime
{
    public static function at(string $date, ?CarbonInterface $openStart, ?CarbonInterface $lastActivity, AttendancePolicy $policy, ?CarbonInterface $now = null, ?CarbonInterface $legacySeen = null): CarbonImmutable
    {
        $tz = config('app.timezone');
        $now = $now ? CarbonImmutable::instance($now) : CarbonImmutable::now($tz);
        $shiftEnd = CarbonImmutable::parse("{$date} {$policy->shift_end}", $tz);
        $midnight = CarbonImmutable::parse($date, $tz)->endOfDay();
        $open = $openStart ? CarbonImmutable::instance($openStart) : null;

        // The last real input (keyboard/mouse, clamped server-side) is when work stopped, overtime included. Days from
        // before activity tracking only have the sign-in heartbeat (`legacySeen`, same date only), which said nothing
        // about input: it is capped at shift end, and without it the day closes at the open segment's start.
        if ($lastActivity) {
            $end = CarbonImmutable::instance($lastActivity);
        } else {
            $end = $legacySeen ? CarbonImmutable::instance($legacySeen) : ($open ?? $shiftEnd);
            if (! $open || $open->lt($shiftEnd)) {
                $end = $end->min($shiftEnd);
            }
        }
        $end = $end->min($midnight)->min($now);

        return $open ? $end->max($open) : $end;
    }

    /**
     * The "as of" instant for totals: now for today or finished days, the deemed close time for a past day that was
     * left running (so history never counts hours that were not worked).
     *
     * @param  iterable<TimeSegment>  $segments
     */
    public static function asOf(AttendanceDay $day, iterable $segments, CarbonInterface $now): CarbonInterface
    {
        $date = $day->date->format('Y-m-d');
        if ($date >= $now->toDateString()) {
            return $now;
        }
        $open = collect($segments)->filter(fn ($s) => $s->ended_at === null)->sortByDesc('started_at')->first();
        if (! $open) {
            return $now;
        }

        return self::at($date, $open->started_at, $day->last_activity_at, AttendancePolicy::forDate($date), $now, self::legacySeen($day));
    }

    /** The user's last heartbeat when it falls on the day itself; only used for days without `last_activity_at`. */
    public static function legacySeen(AttendanceDay $day): ?CarbonInterface
    {
        if ($day->last_activity_at) {
            return null;
        }
        $seen = User::where('employee_id', $day->employee_id)->value('last_seen_at');
        if (! $seen) {
            return null;
        }
        $seen = CarbonImmutable::parse($seen, config('app.timezone'));

        return $seen->toDateString() === $day->date->format('Y-m-d') ? $seen : null;
    }
}
