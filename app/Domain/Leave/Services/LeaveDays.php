<?php

namespace App\Domain\Leave\Services;

use Carbon\CarbonImmutable;

/** Pure working-day counter. Port of computeLeaveDays in resources/js/mock/db/leave.ts. */
final class LeaveDays
{
    /**
     * Working days in [start, end] excluding weekend days (0=Sun..6=Sat, default Fri and Sat) and holidays.
     * A half day on a single working day counts 0.5.
     *
     * @param  list<string>  $holidays  Y-m-d
     * @param  list<int>  $weekend
     */
    public static function count(string $start, string $end, string $half = 'none', array $holidays = [], array $weekend = [5, 6]): float
    {
        if ($end < $start) {
            return 0.0;
        }
        $count = 0;
        for ($d = CarbonImmutable::parse($start); $d->format('Y-m-d') <= $end; $d = $d->addDay()) {
            if (! in_array($d->dayOfWeek, $weekend, true) && ! in_array($d->format('Y-m-d'), $holidays, true)) {
                $count++;
            }
        }
        if ($half !== 'none' && $start === $end && $count === 1) {
            return 0.5;
        }

        return (float) $count;
    }
}
