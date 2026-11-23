<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendancePolicy;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Tells a server/network outage (everyone went silent at once) from one person's lost connection, using
 * heartbeat_ticks: one row per user per minute in which the server received a heartbeat from them.
 */
final class Outage
{
    /** Need at least this many other people beating just before a gap to call a silence an outage. */
    public const MIN_PEERS = 2;

    public static function tick(string $userId, CarbonInterface $at): void
    {
        DB::table('heartbeat_ticks')->insertOrIgnore(['minute' => self::minute($at), 'user_id' => $userId]);
    }

    /**
     * Windows inside ($from, $to) in which nobody but $userId reached the server for at least the offline threshold,
     * while at least MIN_PEERS others had been beating in the threshold before $from.
     *
     * @return list<array{0:CarbonImmutable,1:CarbonImmutable}>
     */
    public static function darkWindows(string $userId, CarbonInterface $from, CarbonInterface $to): array
    {
        $limit = AttendancePolicy::current()->offline_after_minutes;
        $from = CarbonImmutable::instance($from);
        $to = CarbonImmutable::instance($to);
        $peers = DB::table('heartbeat_ticks')->where('user_id', '!=', $userId)
            ->whereBetween('minute', [self::minute($from->subMinutes($limit)), self::minute($from)])
            ->distinct()->count('user_id');
        if ($peers < self::MIN_PEERS) {
            return [];
        }
        $lit = DB::table('heartbeat_ticks')->where('user_id', '!=', $userId)
            ->whereBetween('minute', [self::minute($from), self::minute($to)])
            ->distinct()->pluck('minute')->map(fn ($m) => substr((string) $m, 0, 16))->flip();

        $windows = [];
        $runStart = null;
        // Whole minutes strictly inside the gap; a run of silent minutes as long as the threshold is an outage.
        for ($m = $from->startOfMinute()->addMinute(); $m < $to->startOfMinute(); $m = $m->addMinute()) {
            $silent = ! isset($lit[$m->format('Y-m-d H:i')]);
            if ($silent && ! $runStart) {
                $runStart = $m;
            }
            if (! $silent && $runStart) {
                self::push($windows, $runStart, $m, $limit);
                $runStart = null;
            }
        }
        if ($runStart) {
            self::push($windows, $runStart, $to->startOfMinute(), $limit);
        }

        return $windows;
    }

    /** No heartbeat from anyone in the last threshold although several people have a running day: the server was dark. */
    public static function serverDarkNow(CarbonInterface $now, int $runningDays): bool
    {
        if ($runningDays < self::MIN_PEERS) {
            return false;
        }
        $limit = AttendancePolicy::current()->offline_after_minutes;

        return ! DB::table('heartbeat_ticks')->where('minute', '>', self::minute(CarbonImmutable::instance($now)->subMinutes($limit)))->exists();
    }

    public static function prune(CarbonInterface $now): int
    {
        return DB::table('heartbeat_ticks')->where('minute', '<', self::minute(CarbonImmutable::instance($now)->subDays(3)))->delete();
    }

    /** @param list<array{0:CarbonImmutable,1:CarbonImmutable}> $windows */
    private static function push(array &$windows, CarbonImmutable $start, CarbonImmutable $end, int $limit): void
    {
        if ($end->diffInMinutes($start, true) >= $limit) {
            $windows[] = [$start, $end];
        }
    }

    private static function minute(CarbonInterface $at): string
    {
        return $at->copy()->startOfMinute()->format('Y-m-d H:i:s');
    }
}
