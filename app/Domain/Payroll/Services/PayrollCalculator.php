<?php

namespace App\Domain\Payroll\Services;

use App\Models\AttendancePolicy;

/**
 * Pure payroll maths, ported from calcItem() in resources/js/mock/db/payroll.ts.
 *
 * Facts: structure (basic, gross, hourly_rate, pf_percent, tax_monthly), working_days, worked_minutes,
 * unpaid_days, late_count, adjustments (list of kind/amount). Returns the money and attendance fields of an item.
 */
final class PayrollCalculator
{
    public function __construct(
        private int $standardMinutes = 480,
        private int $latesPerPenalty = 3,
        private float $penaltyDays = 0.5,
        private bool $overtimeEnabled = false,
        private float $overtimeMultiplier = 1.0,
    ) {}

    public static function fromPolicy(AttendancePolicy $policy): self
    {
        $rule = $policy->late_penalty_rule ?? [];

        return new self(
            (int) $policy->standard_minutes,
            (int) ($rule['lates_per_penalty'] ?? 0),
            (float) ($rule['penalty_days'] ?? 0),
        );
    }

    /** @param list<array{kind:string,amount:int|float}> $adjustments @return array{bonus:int,deduction:int} */
    public static function adjustmentTotals(array $adjustments): array
    {
        $sum = fn (string $kind) => (int) array_sum(array_map(
            fn ($a) => $a['kind'] === $kind ? $a['amount'] : 0, $adjustments,
        ));

        return ['bonus' => $sum('bonus'), 'deduction' => $sum('deduction')];
    }

    /**
     * @param  array{structure: array<string,mixed>, working_days: int|float, worked_minutes: int, unpaid_days: int|float, late_count: int, adjustments: list<array{kind:string,amount:int|float}>}  $f
     * @return array<string,int|float>
     */
    public function calc(array $f): array
    {
        $s = $f['structure'];
        $gross = (int) $s['gross'];
        $standard = (int) round($f['working_days'] * $this->standardMinutes);
        $overtime = max(0, $f['worked_minutes'] - $standard);
        $daily = $f['working_days'] > 0 ? $gross / $f['working_days'] : 0;
        $lateUnits = $this->latesPerPenalty > 0 ? intdiv($f['late_count'], $this->latesPerPenalty) : 0;
        $lateDeduction = (int) round($lateUnits * $this->penaltyDays * $daily);
        $unpaidDeduction = (int) round($f['unpaid_days'] * $daily);
        $overtimePay = $this->overtimeEnabled
            ? (int) round(($overtime / 60) * $s['hourly_rate'] * $this->overtimeMultiplier)
            : 0;
        $pf = (int) round(($s['basic'] * $s['pf_percent']) / 100);
        $adj = self::adjustmentTotals($f['adjustments']);
        $tax = (int) $s['tax_monthly'];
        $net = $gross + $overtimePay + $adj['bonus'] - $unpaidDeduction - $lateDeduction - $tax - $pf - $adj['deduction'];

        return [
            'standard_minutes' => $standard,
            'worked_minutes' => $f['worked_minutes'],
            'overtime_minutes' => $overtime,
            'unpaid_leave_days' => $f['unpaid_days'],
            'late_count' => $f['late_count'],
            'gross' => $gross,
            'overtime_pay' => $overtimePay,
            'unpaid_deduction' => $unpaidDeduction,
            'late_deduction' => $lateDeduction,
            'tax' => $tax,
            'pf' => $pf,
            'net' => $net,
        ];
    }
}
