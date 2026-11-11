<?php

use App\Domain\Payroll\Services\PayrollCalculator;

function payrollFacts(array $over = []): array
{
    return [
        'structure' => ['basic' => 55000, 'gross' => 100000, 'hourly_rate' => 568, 'pf_percent' => 5, 'tax_monthly' => 4000],
        'working_days' => 20, 'worked_minutes' => 20 * 480, 'unpaid_days' => 0, 'late_count' => 0, 'adjustments' => [],
        ...$over,
    ];
}

it('pays gross less tax and provident fund when nothing else applies', function () {
    $r = (new PayrollCalculator)->calc(payrollFacts());
    expect($r)->toMatchArray(['standard_minutes' => 9600, 'overtime_minutes' => 0, 'pf' => 2750, 'tax' => 4000, 'unpaid_deduction' => 0, 'late_deduction' => 0, 'net' => 93250]);
});

it('penalises half a day for every three lates', function () {
    $calc = new PayrollCalculator;
    expect($calc->calc(payrollFacts(['late_count' => 2]))['late_deduction'])->toBe(0)
        ->and($calc->calc(payrollFacts(['late_count' => 3]))['late_deduction'])->toBe(2500)
        ->and($calc->calc(payrollFacts(['late_count' => 7]))['late_deduction'])->toBe(5000);
});

it('deducts unpaid leave at the daily rate and adds adjustments to net', function () {
    $r = (new PayrollCalculator)->calc(payrollFacts([
        'unpaid_days' => 1, 'late_count' => 7,
        'adjustments' => [['kind' => 'bonus', 'amount' => 2000], ['kind' => 'deduction', 'amount' => 500]],
    ]));
    expect($r['unpaid_deduction'])->toBe(5000)->and($r['late_deduction'])->toBe(5000)
        ->and($r['net'])->toBe(100000 + 2000 - 5000 - 5000 - 4000 - 2750 - 500);
});

it('records overtime minutes but does not pay them by default', function () {
    $r = (new PayrollCalculator)->calc(payrollFacts(['worked_minutes' => 9600 + 120]));
    expect($r['overtime_minutes'])->toBe(120)->and($r['overtime_pay'])->toBe(0);
    $paid = (new PayrollCalculator(overtimeEnabled: true))->calc(payrollFacts(['worked_minutes' => 9600 + 120]));
    expect($paid['overtime_pay'])->toBe(1136);
});

it('handles a month with no working days', function () {
    $r = (new PayrollCalculator)->calc(payrollFacts(['working_days' => 0, 'worked_minutes' => 0, 'unpaid_days' => 1, 'late_count' => 3]));
    expect($r['unpaid_deduction'])->toBe(0)->and($r['late_deduction'])->toBe(0);
});
