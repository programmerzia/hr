<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\TimeSegment;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/** Chart data shared by the history page and the People profile tab. */
final class Series
{
    /** Work seconds per attendance day id (open segments run to $now). @return array<string,int> */
    public static function workByDay(iterable $dayIds, CarbonInterface $now): array
    {
        $policy = AttendancePolicy::current();
        $out = [];
        $segs = TimeSegment::whereIn('attendance_day_id', collect($dayIds)->all())->get()->groupBy('attendance_day_id');
        foreach ($segs as $id => $list) {
            $out[$id] = DayCalculator::totals($list, $now, $policy->lunch_cap_minutes)['work_seconds'];
        }

        return $out;
    }

    /**
     * Last $count days per employee, ending today. state: off (weekend/holiday), leave, pending (today or later, no
     * record yet), none (past workday without a record) or worked.
     *
     * @param  list<string>  $employeeIds
     * @return array<string, list<array{date:string,state:string,work_seconds:int,late_minutes:int}>>
     */
    public static function heat(array $employeeIds, CarbonInterface $now, int $count = 30): array
    {
        $end = CarbonImmutable::instance($now)->startOfDay();
        $start = $end->subDays($count - 1);
        $policy = AttendancePolicy::current();
        $holidays = Holiday::whereBetween('date', [$start->toDateString(), $end->toDateString()])->get()
            ->map(fn ($h) => $h->date->format('Y-m-d'))->flip();
        $days = AttendanceDay::whereIn('employee_id', $employeeIds)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])->get();
        $work = self::workByDay($days->pluck('id'), $now);
        $byEmp = $days->groupBy('employee_id')->map(fn (Collection $c) => $c->keyBy(fn ($d) => $d->date->format('Y-m-d')));

        $out = [];
        foreach ($employeeIds as $eid) {
            $cells = [];
            for ($i = 0; $i < $count; $i++) {
                $d = $start->addDays($i);
                $key = $d->toDateString();
                $rec = $byEmp[$eid][$key] ?? null;
                if (in_array($d->dayOfWeek, $policy->weekend_days ?? [], true) || isset($holidays[$key])) {
                    $state = 'off';
                } elseif (! $rec || ! $rec->first_in_at) {
                    $state = $rec?->status === 'on_leave' ? 'leave' : ($key >= $end->toDateString() ? 'pending' : 'none');
                } else {
                    $state = 'worked';
                }
                $cells[] = [
                    'date' => $key,
                    'state' => $state,
                    'work_seconds' => $rec ? (int) ($work[$rec->id] ?? 0) : 0,
                    'late_minutes' => (int) ($rec->late_minutes ?? 0),
                ];
            }
            $out[$eid] = $cells;
        }

        return $out;
    }

    /** Work seconds per calendar week of the current month (days 1-7, 8-14, ...). @return array{month:string, weeks:list<int>} */
    public static function monthWeeks(string $employeeId, CarbonInterface $now): array
    {
        $first = CarbonImmutable::instance($now)->startOfMonth();
        $weeks = array_fill(0, (int) ceil($first->daysInMonth / 7), 0);
        $days = AttendanceDay::where('employee_id', $employeeId)
            ->whereBetween('date', [$first->toDateString(), $first->endOfMonth()->toDateString()])->get();
        $work = self::workByDay($days->pluck('id'), $now);
        foreach ($days as $d) {
            $weeks[intdiv($d->date->day - 1, 7)] += $work[$d->id] ?? 0;
        }

        return ['month' => $first->format('F'), 'weeks' => $weeks, 'current' => intdiv($now->day - 1, 7), 'days_in_month' => $first->daysInMonth];
    }
}
