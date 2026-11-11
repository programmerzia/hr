<?php

use App\Domain\Attendance\Services\DayCalculator;
use App\Models\TimeSegment;
use Carbon\CarbonImmutable;

it('splits work, chosen breaks, idle and offline and flags lunch over cap', function () {
    $t = CarbonImmutable::parse('2026-11-12 10:00:00');
    $seg = fn ($type, $cat, $from, $to) => new TimeSegment(['type' => $type, 'break_category' => $cat, 'started_at' => $t->addMinutes($from), 'ended_at' => $to === null ? null : $t->addMinutes($to)]);
    $totals = DayCalculator::totals([
        $seg('work', null, 0, 120),
        $seg('break', 'lunch', 120, 195),
        $seg('break', 'idle', 195, 205),
        $seg('break', 'offline', 205, 215),
        $seg('work', null, 215, null),
    ], $t->addMinutes(275), 60);

    expect($totals)->toBe([
        'work_seconds' => 180 * 60,
        'break_seconds' => 75 * 60,
        'idle_seconds' => 600,
        'offline_seconds' => 600,
        'lunch_over_cap_minutes' => 15,
    ]);
});
