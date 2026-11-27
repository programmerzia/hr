<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendancePolicy;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Tells the server's own outage from people losing their connection. Only the server's own signs of life count:
 * attendance:sweep (scheduled every minute) writes one server_ticks row per minute it runs. Minutes without a tick, in
 * a run at least as long as the offline threshold, are an outage (counted as work). Everyone going quiet while the
 * server kept ticking (office internet down, say) is offline for each of them, not an outage.
 *
 * heartbeat_ticks (one row per user per minute with a heartbeat) are still written; they are kept for diagnostics.
 */
final class Outage
{
    public static function tick(string $userId, CarbonInterface $at): void
    {
        DB::table('heartbeat_ticks')->insertOrIgnore(['minute' => self::minute($at), 'user_id' => $userId]);
    }

    /** Called by every attendance:sweep run: the server was alive this minute. */
    public static function serverTick(CarbonInterface $at): void
    {
        DB::table('server_ticks')->insertOrIgnore(['minute' => self::minute($at)]);
    }

    /**
     * Windows inside ($from, $to) in which the server itself showed no life (no sweep run) for at least the offline
     * threshold. Only when the sweep was running just before $from: without a scheduler at all nothing is an outage.
     *
     * @return list<array{0:CarbonImmutable,1:CarbonImmutable}>
     */
    public static function darkWindows(string $userId, CarbonInterface $from, CarbonInterface $to): array
    {
        $limit = AttendancePolicy::current()->offline_after_minutes;
        $from = CarbonImmutable::instance($from);
        $to = CarbonImmutable::instance($to);
        $aliveBefore = DB::table('server_ticks')
            ->whereBetween('minute', [self::minute($from->subMinutes($limit)), self::minute($from)])->exists();
        if (! $aliveBefore) {
            return [];
        }
        $lit = DB::table('server_ticks')->whereBetween('minute', [self::minute($from), self::minute($to)])
            ->pluck('minute')->map(fn ($m) => substr((string) $m, 0, 16))->flip();

        $windows = [];
        $runStart = null;
        // Whole minutes strictly inside the gap; a run of tick-less minutes as long as the threshold is an outage.
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

    /**
     * True for the first sweep after the server itself was down (earlier ticks exist, none in the last threshold):
     * nobody could reach it, so the sweep waits for heartbeats to come back instead of opening breaks for everyone.
     */
    public static function serverWasDark(CarbonInterface $now): bool
    {
        $limit = AttendancePolicy::current()->offline_after_minutes;
        $since = self::minute(CarbonImmutable::instance($now)->subMinutes($limit));
        $before = DB::table('server_ticks')->where('minute', '<', self::minute($now));
        if (! (clone $before)->where('minute', '>=', self::minute(CarbonImmutable::instance($now)->subDay()))->exists()) {
            return false; // no recent history (first run, or the scheduler was never on): nothing to compare with
        }

        return ! (clone $before)->where('minute', '>=', $since)->exists();
    }

    public static function prune(CarbonInterface $now): int
    {
        $cut = self::minute(CarbonImmutable::instance($now)->subDays(3));
        DB::table('server_ticks')->where('minute', '<', $cut)->delete();

        return DB::table('heartbeat_ticks')->where('minute', '<', $cut)->delete();
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
