<?php

namespace App\Domain\Payroll\Services;

use App\Models\PayrollPolicy;

/**
 * Pure payroll maths (docs/07 §2). Salary is monthly; the daily rate only prices deductions.
 *
 *   share(slice)    = round(slice.gross × slice.units / denom), denom = units of the whole month for a full month,
 *                     otherwise max(divisor, Σ units). A full single-slice month is therefore exactly gross.
 *   daily_rate      = structure.gross / divisor (structure in force at the end of the window)
 *   lop             = lop_enabled ? round((absent + half × 0.5 + unpaid_leave) × daily_rate) : 0
 *   late days       = late_penalty_enabled ? min(floor(late_count / lates_per_penalty) × penalty_days, cap) : 0
 *   overtime_pay    = overtime_enabled ? round(ot_minutes / 60 × hourly × multiplier) : 0
 *   pf / pf_employer= pf_enabled ? round(earned_basic × percent / 100) : 0 (structure % overrides policy %)
 *   tax             = tax_enabled ? structure.tax_monthly : 0
 *   net             = gross + overtime + bonus − lop − late − tax − pf − deductions
 */
final class PayrollCalculator
{
    /** @param iterable<array{kind:string,amount:int|float}> $adjustments @return array{bonus:int,deduction:int} */
    public static function adjustmentTotals(iterable $adjustments): array
    {
        $t = ['bonus' => 0, 'deduction' => 0];
        foreach ($adjustments as $a) {
            if (isset($t[$a['kind']])) {
                $t[$a['kind']] += (int) $a['amount'];
            }
        }

        return $t;
    }

    /**
     * @param  list<array{effective_from:string,structure_id:string,structure:array<string,mixed>,units:int|float}>  $slices
     * @param  array<string,mixed>  $facts  output of PayrollFacts::for (without needing slices)
     * @param  iterable<array{kind:string,amount:int|float}>  $adjustments
     * @return array<string,mixed> payroll_items columns
     */
    public static function compute(PayrollPolicy $policy, array $slices, array $facts, iterable $adjustments = []): array
    {
        $divisor = max(0, (int) ($facts['divisor'] ?? 0));
        $totalUnits = array_sum(array_map(fn ($s) => (float) $s['units'], $slices));
        $denom = ! empty($facts['full_month']) ? $totalUnits : max($divisor, $totalUnits);

        $sliceOut = [];
        $parts = [];
        foreach ($slices as $s) {
            $st = $s['structure'];
            $factor = $denom > 0 ? (float) $s['units'] / $denom : 0.0;
            $share = (int) round($st['gross'] * $factor);
            $sliceOut[] = [
                'effective_from' => $s['effective_from'], 'structure_id' => $s['structure_id'],
                'days' => (float) $s['units'], 'gross' => (int) $st['gross'], 'gross_share' => $share,
            ];
            $named = ['basic' => $st['basic'], 'house_rent' => $st['house_rent'], 'medical' => $st['medical'], 'conveyance' => $st['conveyance']];
            foreach ($st['other_allowances'] ?? [] as $o) {
                $named['other:'.$o['label']] = ($named['other:'.$o['label']] ?? 0) + $o['amount'];
            }
            $residual = $st['gross'] - array_sum($named);
            if ($residual !== 0) {
                $named['other:Other'] = ($named['other:Other'] ?? 0) + $residual;
            }
            foreach ($named as $k => $v) {
                $parts[$k] = ($parts[$k] ?? 0) + $v * $factor;
            }
        }
        $gross = array_sum(array_column($sliceOut, 'gross_share'));
        $rounded = self::roundTo($parts, $gross);
        $components = [
            'basic' => $rounded['basic'] ?? 0, 'house_rent' => $rounded['house_rent'] ?? 0,
            'medical' => $rounded['medical'] ?? 0, 'conveyance' => $rounded['conveyance'] ?? 0, 'other_allowances' => [],
        ];
        foreach ($rounded as $k => $v) {
            if (str_starts_with($k, 'other:') && $v !== 0) {
                $components['other_allowances'][] = ['label' => substr($k, 6), 'amount' => $v];
            }
        }

        $ref = $slices === [] ? null : end($slices)['structure'];
        $refGross = (int) ($ref['gross'] ?? 0);
        $daily = $divisor > 0 ? $refGross / $divisor : 0.0;
        $std = (int) ($facts['standard_minutes_per_day'] ?? 480);
        $hourly = (int) ($ref['hourly_rate'] ?? 0) ?: ($divisor > 0 && $std > 0 ? $refGross / ($divisor * $std / 60) : 0.0);

        $absent = (float) ($facts['absent_days'] ?? 0);
        $half = (float) ($facts['half_days'] ?? 0);
        $unpaid = (float) ($facts['unpaid_leave_days'] ?? 0);
        $lopDays = $policy->lop_enabled ? $absent + $half * 0.5 + $unpaid : 0.0;
        $lop = (int) round($lopDays * $daily);

        $lateCount = (int) ($facts['late_count'] ?? 0);
        $per = (int) $policy->lates_per_penalty;
        $lateDays = $policy->late_penalty_enabled && $per > 0
            ? min(intdiv($lateCount, $per) * (float) $policy->penalty_days, (float) $policy->max_penalty_days_per_month)
            : 0.0;
        $late = (int) round($lateDays * $daily);

        $otMinutes = (int) ($facts['overtime_minutes'] ?? 0);
        $overtime = $policy->overtime_enabled ? (int) round($otMinutes / 60 * $hourly * (float) $policy->overtime_multiplier) : 0;

        $pfEmpPct = (float) ($ref['pf_percent'] ?? 0) ?: (float) $policy->pf_employee_percent;
        $pfErPct = ($ref['pf_employer_percent'] ?? null) !== null ? (float) $ref['pf_employer_percent'] : (float) $policy->pf_employer_percent;
        $pf = $policy->pf_enabled ? (int) round($components['basic'] * $pfEmpPct / 100) : 0;
        $pfEmployer = $policy->pf_enabled ? (int) round($components['basic'] * $pfErPct / 100) : 0;
        $tax = $policy->tax_enabled ? (int) ($ref['tax_monthly'] ?? 0) : 0;

        $adj = self::adjustmentTotals($adjustments);
        $net = $gross + $overtime + $adj['bonus'] - $lop - $late - $tax - $pf - $adj['deduction'];

        return [
            'salary_structure_id' => $ref['id'] ?? null,
            'standard_minutes' => (int) ($facts['standard_minutes'] ?? 0),
            'worked_minutes' => (int) ($facts['worked_minutes'] ?? 0),
            'overtime_minutes' => $otMinutes,
            'late_count' => $lateCount,
            'eligible_days' => (float) ($facts['eligible_days'] ?? 0),
            'absent_days' => $absent,
            'half_days' => $half,
            'paid_leave_days' => (float) ($facts['paid_leave_days'] ?? 0),
            'holiday_days' => (float) ($facts['holiday_days'] ?? 0),
            'unpaid_leave_days' => $unpaid,
            'day_fraction_total' => (float) ($facts['day_fraction_total'] ?? 0),
            'lop_days' => round($lopDays, 2),
            'late_penalty_days' => round($lateDays, 2),
            'gross' => $gross,
            'overtime_pay' => $overtime,
            'unpaid_deduction' => $lop,
            'late_deduction' => $late,
            'tax' => $tax,
            'pf' => $pf,
            'pf_employer' => $pfEmployer,
            'net' => $net,
            'components' => [
                ...$components,
                'basis' => $facts['basis'] ?? $policy->daily_rate_basis, 'divisor' => $divisor,
                'daily_rate' => round($daily, 2), 'hourly_rate' => round((float) $hourly, 2),
            ],
            'slices' => $sliceOut,
        ];
    }

    /** Largest-remainder rounding so the parts sum exactly to $total. @param array<string,float> $parts @return array<string,int> */
    private static function roundTo(array $parts, int $total): array
    {
        $out = array_map(fn ($v) => (int) floor($v), $parts);
        $left = $total - array_sum($out);
        $rem = array_map(fn ($v) => $v - floor($v), $parts);
        arsort($rem);
        foreach (array_keys($rem) as $k) {
            if ($left <= 0) {
                break;
            }
            $out[$k]++;
            $left--;
        }
        if ($left !== 0 && $out !== []) {
            $out[array_key_first($out)] += $left;
        }

        return $out;
    }
}
