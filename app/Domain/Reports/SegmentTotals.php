<?php

namespace App\Domain\Reports;

use App\Models\TimeSegment;
use Carbon\CarbonInterface;

/**
 * Break, offline and idle seconds per attendance day, from time_segments. Break covers every
 * non-work segment that is not idle or offline (short, tea, lunch, official, signed out). Open segments run to now.
 */
final class SegmentTotals
{
    /** @param list<string> $dayIds @return array<string,array{break:int,offline:int,idle:int}> keyed by attendance_day_id */
    public static function forDays(array $dayIds, ?CarbonInterface $now = null): array
    {
        $now ??= now();
        $out = [];
        foreach (array_chunk($dayIds, 500) as $chunk) {
            TimeSegment::whereIn('attendance_day_id', $chunk)->where('type', 'break')
                ->get(['attendance_day_id', 'break_category', 'started_at', 'ended_at'])
                ->each(function ($s) use (&$out, $now) {
                    $end = $s->ended_at ?? $now;
                    $sec = max(0, $end->getTimestamp() - $s->started_at->getTimestamp());
                    $key = match ($s->break_category) {
                        'offline' => 'offline',
                        'idle' => 'idle',
                        default => 'break',
                    };
                    $out[$s->attendance_day_id] ??= ['break' => 0, 'offline' => 0, 'idle' => 0];
                    $out[$s->attendance_day_id][$key] += $sec;
                });
        }

        return $out;
    }
}
