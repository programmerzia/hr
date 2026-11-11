<?php

use App\Domain\Leave\Services\LeaveDays;

// 2026-11-08 is a Sunday; Friday 13 and Saturday 14 are the weekend.
it('counts working days and skips Friday and Saturday', function () {
    expect(LeaveDays::count('2026-11-08', '2026-11-14'))->toBe(5.0)
        ->and(LeaveDays::count('2026-11-13', '2026-11-14'))->toBe(0.0)
        ->and(LeaveDays::count('2026-11-12', '2026-11-15'))->toBe(2.0);
});

it('skips holidays', function () {
    expect(LeaveDays::count('2026-11-08', '2026-11-12', 'none', ['2026-11-10']))->toBe(4.0);
});

it('counts a half day as 0.5 only on a single working day', function () {
    expect(LeaveDays::count('2026-11-09', '2026-11-09', 'first_half'))->toBe(0.5)
        ->and(LeaveDays::count('2026-11-13', '2026-11-13', 'first_half'))->toBe(0.0)
        ->and(LeaveDays::count('2026-11-09', '2026-11-09', 'first_half', ['2026-11-09']))->toBe(0.0)
        ->and(LeaveDays::count('2026-11-09', '2026-11-10', 'first_half'))->toBe(2.0);
});

it('returns 0 when the range is reversed', function () {
    expect(LeaveDays::count('2026-11-10', '2026-11-09'))->toBe(0.0);
});
