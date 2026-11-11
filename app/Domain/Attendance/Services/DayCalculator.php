<?php

namespace App\Domain\Attendance\Services;

use App\Models\TimeSegment;
use Carbon\CarbonInterface;

/** Port of computeTotals() in resources/js/mock/stores/attendance.ts. */
final class DayCalculator
{
    /**
     * @param  iterable<TimeSegment>  $segments
     * @return array{work_seconds:int, break_seconds:int, idle_seconds:int, offline_seconds:int, lunch_over_cap_minutes:int}
     */
    public static function totals(iterable $segments, CarbonInterface $now, int $lunchCapMinutes): array
    {
        $work = $brk = $idle = $offline = $lunch = 0;
        foreach ($segments as $s) {
            $end = $s->ended_at ?? $now;
            $secs = max(0, $end->getTimestamp() - $s->started_at->getTimestamp());
            if ($s->type === 'work') {
                $work += $secs;
            } elseif ($s->break_category === 'idle') {
                $idle += $secs;
            } elseif ($s->break_category === 'offline') {
                $offline += $secs;
            } else {
                $brk += $secs;
                if ($s->break_category === 'lunch') {
                    $lunch += $secs;
                }
            }
        }

        return [
            'work_seconds' => $work,
            'break_seconds' => $brk,
            'idle_seconds' => $idle,
            'offline_seconds' => $offline,
            'lunch_over_cap_minutes' => max(0, intdiv($lunch, 60) - $lunchCapMinutes),
        ];
    }
}
