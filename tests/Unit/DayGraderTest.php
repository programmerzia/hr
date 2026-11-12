<?php

use App\Domain\Attendance\Services\DayGrader;
use App\Models\AttendancePolicy;

// Shift 10:00-19:00, grace 15, half day after 120, early grace 30, half-day min 240, absent below 60, standard 480.
function graderPolicy(): AttendancePolicy
{
    return new AttendancePolicy(AttendancePolicy::DEFAULTS);
}

function g(array $in): array
{
    return DayGrader::grade(graderPolicy(), ['date' => '2026-11-11', ...$in]);
}

$h = fn (int $hours, int $min = 0) => $hours * 3600 + $min * 60;

dataset('grades', [
    'weekend no work' => [['is_weekend' => true], 1.0, 'weekend', 0, 0, 0],
    'holiday with work is all overtime' => [['is_holiday' => true, 'first_in_at' => '2026-11-11 11:00', 'last_out_at' => '2026-11-11 14:00', 'work_seconds' => $h(3)], 1.0, 'holiday', 0, 0, 180],
    'full paid leave' => [['leave_weight' => 1, 'leave_paid' => true], 1.0, 'paid_leave', 0, 0, 0],
    'full unpaid leave' => [['leave_weight' => 1, 'leave_paid' => false], 0.0, 'unpaid_leave', 0, 0, 0],
    'no attendance, no leave' => [[], 0.0, 'unapproved', 0, 0, 0],
    'on time full day' => [['first_in_at' => '2026-11-11 10:05', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(8)], 1.0, 'none', 0, 0, 0],
    'late within half-day threshold' => [['first_in_at' => '2026-11-11 10:40', 'last_out_at' => '2026-11-11 19:10', 'work_seconds' => $h(8)], 1.0, 'none', 40, 0, 0],
    'late past half-day threshold' => [['first_in_at' => '2026-11-11 12:30', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(6)], 0.5, 'half_day', 150, 0, 0],
    'under half-day minimum' => [['first_in_at' => '2026-11-11 10:00', 'last_out_at' => '2026-11-11 13:00', 'work_seconds' => $h(3)], 0.5, 'half_day', 0, 360, 0],
    'under absent minimum' => [['first_in_at' => '2026-11-11 10:00', 'last_out_at' => '2026-11-11 10:30', 'work_seconds' => $h(0, 30)], 0.0, 'unapproved', 0, 510, 0],
    'early leave beyond grace' => [['first_in_at' => '2026-11-11 09:30', 'last_out_at' => '2026-11-11 18:00', 'work_seconds' => $h(8)], 1.0, 'none', 0, 60, 0],
    'early leave within grace' => [['first_in_at' => '2026-11-11 10:00', 'last_out_at' => '2026-11-11 18:40', 'work_seconds' => $h(8)], 1.0, 'none', 0, 0, 0],
    'overtime on working day' => [['first_in_at' => '2026-11-11 10:00', 'last_out_at' => '2026-11-11 21:00', 'work_seconds' => $h(10)], 1.0, 'none', 0, 0, 120],
    'half paid leave + half worked' => [['leave_weight' => 0.5, 'leave_paid' => true, 'first_in_at' => '2026-11-11 14:00', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(4, 30)], 1.0, 'paid_leave', 0, 0, 0],
    'half unpaid leave + half worked' => [['leave_weight' => 0.5, 'leave_paid' => false, 'first_in_at' => '2026-11-11 14:00', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(4, 30)], 0.5, 'unpaid_leave', 0, 0, 0],
    'half paid leave, not worked' => [['leave_weight' => 0.5, 'leave_paid' => true], 0.5, 'unapproved', 0, 0, 0],
    'regularised excused (absent)' => [['is_regularized' => true, 'regularization_resolution' => 'excused'], 1.0, 'excused', 0, 0, 0],
    'regularised excused (late half day)' => [['first_in_at' => '2026-11-11 12:30', 'last_out_at' => '2026-11-11 18:00', 'work_seconds' => $h(5), 'is_regularized' => true, 'regularization_resolution' => 'excused'], 1.0, 'excused', 0, 0, 0],
    'regularised paid leave' => [['is_regularized' => true, 'regularization_resolution' => 'paid_leave'], 1.0, 'paid_leave', 0, 0, 0],
    'regularised unpaid leave (absent)' => [['is_regularized' => true, 'regularization_resolution' => 'unpaid_leave'], 0.0, 'unpaid_leave', 0, 0, 0],
    'regularised unpaid leave (half day)' => [['first_in_at' => '2026-11-11 10:00', 'last_out_at' => '2026-11-11 13:00', 'work_seconds' => $h(3), 'is_regularized' => true, 'regularization_resolution' => 'unpaid_leave'], 0.5, 'unpaid_leave', 0, 0, 0],
    'regularised keep' => [['first_in_at' => '2026-11-11 12:30', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(6), 'is_regularized' => true, 'regularization_resolution' => 'keep'], 0.5, 'half_day', 150, 0, 0],
    'legacy regularised (no resolution) clears late only' => [['first_in_at' => '2026-11-11 10:40', 'last_out_at' => '2026-11-11 19:00', 'work_seconds' => $h(8), 'is_regularized' => true], 1.0, 'none', 0, 0, 0],
    'weekend ignores regularisation' => [['is_weekend' => true, 'is_regularized' => true, 'regularization_resolution' => 'unpaid_leave'], 1.0, 'weekend', 0, 0, 0],
]);

it('grades a day', function (array $in, float $fraction, string $kind, int $late, int $early, int $ot) {
    expect(g($in))->toBe([
        'day_fraction' => $fraction,
        'absence_kind' => $kind,
        'late_minutes' => $late,
        'early_minutes' => $early,
        'overtime_minutes' => $ot,
    ]);
})->with('grades');

it('reports the half-day threshold at sign-in', function () {
    expect(DayGrader::late(graderPolicy(), '2026-11-11', '2026-11-11 12:00'))->toBe([120, false])
        ->and(DayGrader::late(graderPolicy(), '2026-11-11', '2026-11-11 12:01'))->toBe([121, true])
        ->and(DayGrader::late(graderPolicy(), '2026-11-11', '2026-11-11 10:15'))->toBe([0, false]);
});
