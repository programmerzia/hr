<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\TimeSegment;

/**
 * Offline time the browser caused by pausing (freezing or discarding) the HR tab while the person may well have been
 * working in another window. It is recorded as offline, shown on My day, and can be counted as work through a
 * regularisation of kind `paused` (the lead decides).
 */
final class Paused
{
    public const NOTE = 'Browser paused the HR tab';

    public const COUNTED_NOTE = 'Counted as work (browser paused the HR tab)';

    /**
     * Paused seconds per day id (closed segments only).
     *
     * @param  iterable<string>  $dayIds
     * @return array<string,int>
     */
    public static function secondsByDay(iterable $dayIds): array
    {
        $out = [];
        TimeSegment::whereIn('attendance_day_id', collect($dayIds)->all())->where('break_category', 'offline')
            ->where('note', self::NOTE)->whereNotNull('ended_at')->get()
            ->each(function (TimeSegment $s) use (&$out) {
                $out[$s->attendance_day_id] = ($out[$s->attendance_day_id] ?? 0) + max(0, $s->ended_at->getTimestamp() - $s->started_at->getTimestamp());
            });

        return $out;
    }

    public static function seconds(AttendanceDay $day): int
    {
        return self::secondsByDay([$day->id])[$day->id] ?? 0;
    }

    /** Turns the day's paused offline stretches into work and refreshes its totals. Returns the seconds converted. */
    public static function countAsWork(AttendanceDay $day): int
    {
        $segs = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')
            ->where('note', self::NOTE)->whereNotNull('ended_at')->get();
        $seconds = 0;
        foreach ($segs as $s) {
            $seconds += max(0, $s->ended_at->getTimestamp() - $s->started_at->getTimestamp());
            $s->update(['type' => 'work', 'break_category' => null, 'source' => 'correction', 'note' => self::COUNTED_NOTE]);
        }
        if ($seconds > 0) {
            $date = $day->date->format('Y-m-d');
            $asOf = in_array($day->status, ['working', 'on_break'], true) ? now() : ($day->last_out_at ?? now());
            $t = DayCalculator::totals($day->segments()->get(), $asOf, AttendancePolicy::forDate($date)->lunch_cap_minutes);
            $day->work_seconds = $t['work_seconds'];
            $day->break_seconds = $t['break_seconds'] + $t['idle_seconds'] + $t['offline_seconds'];
        }

        return $seconds;
    }
}
