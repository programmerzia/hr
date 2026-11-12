<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendancePolicy;
use Carbon\CarbonImmutable;

/**
 * Pure day grading (docs/07-payroll-plan.md §2). No database access.
 *
 * day_fraction is the PAID share of the day: worked share plus paid-leave share. LOP for a day is (1 - day_fraction).
 * For absence_kind = unpaid_leave the unpaid leave weight is already inside (1 - day_fraction).
 */
final class DayGrader
{
    /**
     * @param array{
     *   date:string, is_weekend?:bool, is_holiday?:bool, leave_weight?:float|int, leave_paid?:bool,
     *   first_in_at?:mixed, last_out_at?:mixed, work_seconds?:int, is_regularized?:bool,
     *   regularization_resolution?:?string
     * } $in
     * @return array{day_fraction:float, absence_kind:string, late_minutes:int, early_minutes:int, overtime_minutes:int}
     */
    public static function grade(AttendancePolicy $policy, array $in): array
    {
        $date = $in['date'];
        $work = max(0, (int) ($in['work_seconds'] ?? 0));
        $weight = (float) ($in['leave_weight'] ?? 0);
        $weight = $weight >= 1 ? 1.0 : ($weight >= 0.5 ? 0.5 : 0.0);
        $paid = (bool) ($in['leave_paid'] ?? false);
        $firstIn = self::time($in['first_in_at'] ?? null);
        $lastOut = self::time($in['last_out_at'] ?? null);
        $workMin = intdiv($work, 60);

        if (! empty($in['is_weekend']) || ! empty($in['is_holiday'])) {
            return self::out(1, ! empty($in['is_holiday']) ? 'holiday' : 'weekend', 0, 0, $workMin);
        }

        $overtime = max(0, $workMin - (int) $policy->standard_minutes);
        [$late, $halfByLate] = self::late($policy, $date, $firstIn);
        $early = self::early($policy, $date, $lastOut);

        if ($weight >= 1) {
            return self::out($paid ? 1 : 0, $paid ? 'paid_leave' : 'unpaid_leave', 0, 0, $overtime);
        }

        $attended = $firstIn !== null || $work > 0;
        if ($weight == 0.5) {
            // Half the day is leave; the other half must be worked (minimum half-day hours).
            $worked = $attended && $work >= (int) $policy->half_day_min_minutes * 60 ? 0.5 : 0.0;
            $fraction = ($paid ? 0.5 : 0.0) + $worked;
            $kind = $worked > 0 ? ($paid ? 'paid_leave' : 'unpaid_leave') : 'unapproved';
            $graded = self::out($fraction, $kind, 0, 0, $overtime);
        } elseif (! $attended || $work < (int) $policy->absent_below_minutes * 60) {
            $graded = self::out(0, 'unapproved', $attended ? $late : 0, $attended ? $early : 0, $overtime);
        } elseif ($work < (int) $policy->half_day_min_minutes * 60 || $halfByLate) {
            $graded = self::out(0.5, 'half_day', $late, $early, $overtime);
        } else {
            $graded = self::out(1, 'none', $late, $early, $overtime);
        }

        if (empty($in['is_regularized'])) {
            return $graded;
        }

        return match ($in['regularization_resolution'] ?? null) {
            'excused' => [...$graded, 'day_fraction' => 1.0, 'absence_kind' => 'excused', 'late_minutes' => 0, 'early_minutes' => 0],
            'paid_leave' => [...$graded, 'day_fraction' => 1.0, 'absence_kind' => 'paid_leave', 'late_minutes' => 0, 'early_minutes' => 0],
            'unpaid_leave' => [...$graded, 'absence_kind' => 'unpaid_leave', 'late_minutes' => 0, 'early_minutes' => 0],
            'keep' => $graded,
            // Legacy approvals (before resolutions existed) only cleared the late/early mark.
            default => [...$graded, 'late_minutes' => 0, 'early_minutes' => 0],
        };
    }

    /**
     * Late minutes at sign-in and whether the login is past the half-day threshold.
     *
     * @return array{0:int, 1:bool}
     */
    public static function late(AttendancePolicy $policy, string $date, mixed $firstIn): array
    {
        $firstIn = self::time($firstIn);
        if (! $firstIn) {
            return [0, false];
        }
        $start = self::at($date, $policy->shift_start);
        $by = (int) round(($firstIn->getTimestamp() - $start->getTimestamp()) / 60);

        return [$by > (int) $policy->grace_minutes ? $by : 0, $by > (int) $policy->half_day_after_minutes];
    }

    public static function early(AttendancePolicy $policy, string $date, mixed $lastOut): int
    {
        $lastOut = self::time($lastOut);
        if (! $lastOut) {
            return 0;
        }
        $end = self::at($date, $policy->shift_end);
        $by = (int) round(($end->getTimestamp() - $lastOut->getTimestamp()) / 60);

        return $by > (int) $policy->early_leave_grace_minutes ? $by : 0;
    }

    private static function at(string $date, string $time): CarbonImmutable
    {
        return CarbonImmutable::parse(substr($date, 0, 10).' '.$time, config('app.timezone'));
    }

    private static function time(mixed $v): ?CarbonImmutable
    {
        return $v === null || $v === '' ? null : CarbonImmutable::parse($v, config('app.timezone'));
    }

    private static function out(float|int $fraction, string $kind, int $late, int $early, int $overtime): array
    {
        return [
            'day_fraction' => (float) $fraction,
            'absence_kind' => $kind,
            'late_minutes' => $late,
            'early_minutes' => $early,
            'overtime_minutes' => $overtime,
        ];
    }
}
