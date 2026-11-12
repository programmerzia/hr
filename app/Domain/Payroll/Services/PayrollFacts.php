<?php

namespace App\Domain\Payroll\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollPolicy;
use App\Models\SalaryStructure;
use Carbon\CarbonImmutable;

/**
 * Attendance, leave and salary facts for one employee and month (docs/07 §2, replaces PayrollPeriod::facts).
 *
 * Eligible dates = working dates of the month inside [joined_on, exited_on]. Each date is read from attendance_days
 * (day_fraction / absence_kind written by the nightly grader). Fallback: a past working date with no row and no
 * approved leave counts as an unapproved absence (fraction 0); today and later dates count as full days.
 *
 * Proration units follow the daily-rate basis: working dates for working_days/fixed_26, calendar days for
 * calendar_days/fixed_30. Divisor: working dates in the month, days in the month, 30 or 26.
 */
final class PayrollFacts
{
    public const BASES = ['working_days', 'calendar_days', 'fixed_30', 'fixed_26'];

    /** @return array<string,mixed> */
    public static function for(Employee $employee, int $y, int $m, AttendancePolicy $attendance, PayrollPolicy $policy): array
    {
        $first = PayrollPeriod::start($y, $m);
        $last = PayrollPeriod::end($y, $m);
        $today = now()->toDateString();
        $std = (int) $attendance->standard_minutes;
        $workingDates = PayrollPeriod::workingDates($y, $m, $attendance);
        $holidays = PayrollPeriod::holidayDates($y, $m);
        $weekend = $attendance->weekend_days ?? [];

        $from = max($first, $employee->joined_on?->format('Y-m-d') ?? $first);
        $to = min($last, $employee->exited_on?->format('Y-m-d') ?? $last);
        $eligible = array_values(array_filter($workingDates, fn ($d) => $d >= $from && $d <= $to));

        $rows = AttendanceDay::where('employee_id', $employee->id)
            ->whereDate('date', '>=', $first)->whereDate('date', '<=', $last)->get()
            ->keyBy(fn ($d) => $d->date->format('Y-m-d'));
        $paid = self::leaveWeights($employee->id, $eligible, true);
        $unpaid = self::leaveWeights($employee->id, $eligible, false);

        $absent = $half = $paidLeave = $unpaidLeave = $fractionTotal = 0.0;
        $late = 0;
        $worked = 0;
        foreach ($eligible as $date) {
            $row = $rows[$date] ?? null;
            // A day still in progress (today, not yet closed by the nightly job) is not an absence yet: price it as full.
            if ($row && $date >= $today && ! $row->closed_at && in_array($row->status, ['not_started', 'working', 'on_break'], true)) {
                $row = null;
            }
            $p = $paid[$date] ?? 0.0;
            $u = $unpaid[$date] ?? 0.0;
            if ($row) {
                // The grader's day_fraction already includes leave weight: LOP for the day is (1 - fraction).
                $fraction = (float) $row->day_fraction;
                $kind = (string) ($row->absence_kind ?? 'none');
                $missing = max(0.0, 1.0 - $fraction);
                if ($kind === 'paid_leave') {
                    $paidLeave += $p ?: 1.0;
                } elseif ($kind === 'unpaid_leave') {
                    $unpaidLeave += $missing;
                } elseif (! in_array($kind, ['excused', 'holiday', 'weekend'], true)) {
                    $paidLeave += $p;
                    $missing >= 1.0 ? $absent += 1 : $half += $missing * 2;
                }
            } else {
                // Fallback (nightly job missed the day): leave requests decide; past uncovered = absent, future = full.
                $covered = min(1.0, $p + $u);
                $paidLeave += $p;
                $unpaidLeave += $u;
                $fraction = $date < $today ? $p : 1.0;
                $uncovered = $date < $today ? max(0.0, 1.0 - $covered) : 0.0;
                $uncovered >= 1.0 ? $absent += 1 : $half += $uncovered * 2;
            }
            $fractionTotal += $fraction;
            if ($row) {
                $worked += (int) round($row->work_seconds / 60);
                if ($p > 0 && (int) $row->work_seconds === 0) {
                    $worked += (int) round($p * $std);
                }
            } else {
                $worked += $date >= $today ? $std : (int) round($p * $std);
            }
        }

        $inWindow = fn (string $d) => $d >= $from && $d <= $to;
        $earlyCounts = (bool) ($attendance->early_counts_as_late ?? true);
        $overtime = 0;
        $block = max(1, (int) $policy->overtime_min_block_minutes);
        $cap = (int) $policy->overtime_daily_cap_minutes;
        $workingSet = array_flip($workingDates);
        foreach ($rows as $date => $row) {
            if (! $inWindow($date)) {
                continue;
            }
            if (! $row->is_regularized) {
                $late += (int) $row->late_minutes > 0 ? 1 : 0;
                $late += $earlyCounts && (int) $row->early_minutes > 0 ? 1 : 0;
            }
            $raw = $policy->overtime_requires_approval
                ? (int) $row->approved_overtime_minutes
                : (int) round($row->work_seconds / 60) - (isset($workingSet[$date]) ? $std : 0);
            $minutes = intdiv(max(0, $raw), $block) * $block;
            $overtime += $cap > 0 ? min($cap, $minutes) : $minutes;
            if (! isset($workingSet[$date])) {
                $worked += (int) round($row->work_seconds / 60);
            }
        }

        $holidayDays = count(array_filter(array_keys($holidays), function ($d) use ($inWindow, $weekend) {
            return $inWindow($d) && ! in_array(CarbonImmutable::parse($d)->dayOfWeek, $weekend, true);
        }));

        $basis = in_array($policy->daily_rate_basis, self::BASES, true) ? $policy->daily_rate_basis : 'working_days';
        $calendar = in_array($basis, ['calendar_days', 'fixed_30'], true);
        $units = fn (string $a, string $b) => $calendar
            ? ($a > $b ? 0 : CarbonImmutable::parse($a)->diffInDays(CarbonImmutable::parse($b)) + 1)
            : count(array_filter($workingDates, fn ($d) => $d >= $a && $d <= $b));
        $divisor = match ($basis) {
            'calendar_days' => (int) CarbonImmutable::parse($first)->daysInMonth,
            'fixed_30' => 30,
            'fixed_26' => 26,
            default => count($workingDates),
        };

        $slices = $from <= $to ? self::slices($employee->id, $from, $to, $units) : [];
        $full = $from === $first && $to === $last && $slices !== [] && $slices[0]['effective_from'] === $first;

        return [
            'basis' => $basis,
            'divisor' => $divisor,
            'full_month' => $full,
            'month_working_days' => count($workingDates),
            'eligible_days' => (float) count($eligible),
            'absent_days' => (float) $absent,
            'half_days' => round($half, 2),
            'paid_leave_days' => round($paidLeave, 2),
            'unpaid_leave_days' => round($unpaidLeave, 2),
            'holiday_days' => (float) $holidayDays,
            'day_fraction_total' => round($fractionTotal, 2),
            'late_count' => $late,
            'overtime_minutes' => $overtime,
            'worked_minutes' => max(0, $worked),
            'standard_minutes' => count($eligible) * $std,
            'standard_minutes_per_day' => $std,
            'slices' => $slices,
        ];
    }

    /**
     * Salary slices inside [from, to], split at each effective_from. Days before the first structure are unpaid.
     *
     * @param  callable(string,string):int  $units
     * @return list<array{effective_from:string,until:string,structure_id:string,structure:array<string,mixed>,units:int}>
     */
    private static function slices(string $employeeId, string $from, string $to, callable $units): array
    {
        $all = SalaryStructure::where('employee_id', $employeeId)->whereDate('effective_from', '<=', $to)->orderBy('effective_from')->get();
        $bounds = [];
        foreach ($all as $i => $s) {
            $start = max($from, $s->effective_from->format('Y-m-d'));
            $next = $all[$i + 1] ?? null;
            $end = $next ? min($to, $next->effective_from->subDay()->format('Y-m-d')) : $to;
            if ($start > $end) {
                continue;
            }
            $bounds[] = [
                'effective_from' => $start, 'until' => $end, 'structure_id' => $s->id,
                'structure' => self::structure($s), 'units' => $units($start, $end),
            ];
        }

        return $bounds;
    }

    /** @return array<string,mixed> */
    public static function structure(SalaryStructure $s): array
    {
        return [
            'id' => $s->id, 'basic' => (int) $s->basic, 'house_rent' => (int) $s->house_rent, 'medical' => (int) $s->medical,
            'conveyance' => (int) $s->conveyance, 'other_allowances' => $s->otherAllowances(), 'gross' => (int) $s->gross,
            'hourly_rate' => (int) $s->hourly_rate, 'pf_percent' => (float) $s->pf_percent,
            'pf_employer_percent' => $s->pf_employer_percent === null ? null : (float) $s->pf_employer_percent,
            'tax_monthly' => (int) $s->tax_monthly,
        ];
    }

    /** @param list<string> $dates @return array<string,float> approved leave weight per date */
    private static function leaveWeights(string $employeeId, array $dates, bool $paid): array
    {
        $out = [];
        $requests = LeaveRequest::with('leaveType')->where('employee_id', $employeeId)->where('status', 'approved')->get();
        foreach ($requests as $r) {
            if (! $r->leaveType || (bool) $r->leaveType->is_paid !== $paid) {
                continue;
            }
            $a = $r->starts_on->format('Y-m-d');
            $b = $r->ends_on->format('Y-m-d');
            foreach ($dates as $d) {
                if ($d >= $a && $d <= $b) {
                    $out[$d] = max($out[$d] ?? 0, $r->half_day !== 'none' && $a === $b ? 0.5 : 1.0);
                }
            }
        }

        return $out;
    }
}
