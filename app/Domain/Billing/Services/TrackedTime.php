<?php

namespace App\Domain\Billing\Services;

use App\Models\TaskTimeEntry;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Worked time of a person in a month, from task time entries (Asia/Dhaka calendar month). */
final class TrackedTime
{
    /** @return Collection<int, TaskTimeEntry> */
    private static function entries(string $employeeId, int $year, int $month)
    {
        $tz = config('app.timezone');
        $from = CarbonImmutable::create($year, $month, 1, 0, 0, 0, $tz);

        return TaskTimeEntry::where('employee_id', $employeeId)
            ->where('started_at', '>=', $from->utc())
            ->where('started_at', '<', $from->addMonth()->utc())
            ->get(['id', 'started_at', 'seconds']);
    }

    public static function minutes(string $employeeId, int $year, int $month): int
    {
        return (int) round(self::entries($employeeId, $year, $month)->sum('seconds') / 60);
    }

    /** @return list<array{label: string, minutes: int, days: int}> week buckets of 7 calendar days */
    public static function weekly(string $employeeId, int $year, int $month): array
    {
        $tz = config('app.timezone');
        $daysInMonth = CarbonImmutable::create($year, $month, 1, 0, 0, 0, $tz)->daysInMonth;
        $perDay = [];
        foreach (self::entries($employeeId, $year, $month) as $e) {
            $d = (int) $e->started_at->copy()->setTimezone($tz)->format('j');
            $perDay[$d] = ($perDay[$d] ?? 0) + (int) $e->seconds;
        }
        $weeks = [];
        foreach ($perDay as $day => $secs) {
            $w = (int) ceil($day / 7);
            $weeks[$w] ??= ['label' => 'Days '.(($w - 1) * 7 + 1).'-'.min($w * 7, $daysInMonth), 'seconds' => 0, 'days' => 0];
            $weeks[$w]['seconds'] += $secs;
            if ($secs > 0) {
                $weeks[$w]['days']++;
            }
        }
        ksort($weeks);

        return array_values(array_map(fn ($b) => ['label' => $b['label'], 'minutes' => (int) round($b['seconds'] / 60), 'days' => $b['days']], $weeks));
    }
}
