<?php

use App\Domain\Payroll\Services\PayrollCalculator;
use App\Models\PayrollPolicy;

function calcPolicy(array $over = []): PayrollPolicy
{
    return new PayrollPolicy([...PayrollPolicy::DEFAULTS, ...$over]);
}

function calcStructure(array $over = []): array
{
    return [
        'id' => 's1', 'basic' => 55000, 'house_rent' => 25000, 'medical' => 10000, 'conveyance' => 10000, 'other_allowances' => [],
        'gross' => 100000, 'hourly_rate' => 0, 'pf_percent' => 0, 'pf_employer_percent' => null, 'tax_monthly' => 4000, ...$over,
    ];
}

function calcSlices(array $structure = [], int $units = 20): array
{
    return [['effective_from' => '2026-10-01', 'structure_id' => 's1', 'structure' => calcStructure($structure), 'units' => $units]];
}

function calcFacts(array $over = []): array
{
    return [
        'basis' => 'working_days', 'divisor' => 20, 'full_month' => true, 'eligible_days' => 20, 'absent_days' => 0, 'half_days' => 0,
        'unpaid_leave_days' => 0, 'late_count' => 0, 'overtime_minutes' => 0, 'standard_minutes_per_day' => 480, ...$over,
    ];
}

it('pays exactly gross less tax for a full month with default switches', function () {
    $r = PayrollCalculator::compute(calcPolicy(), calcSlices(), calcFacts());
    expect($r)->toMatchArray(['gross' => 100000, 'pf' => 0, 'pf_employer' => 0, 'tax' => 4000, 'unpaid_deduction' => 0, 'late_deduction' => 0, 'net' => 96000])
        ->and($r['components'])->toMatchArray(['basic' => 55000, 'house_rent' => 25000, 'medical' => 10000, 'conveyance' => 10000]);
});

it('keeps a full month at exactly gross whatever the divisor', function (int $divisor) {
    $r = PayrollCalculator::compute(calcPolicy(), calcSlices(['gross' => 100001, 'conveyance' => 10001], 23), calcFacts(['divisor' => $divisor]));
    expect($r['gross'])->toBe(100001);
})->with([22, 31, 30, 26]);

it('prorates a partial month by units over the divisor and splits components to sum to gross', function () {
    $r = PayrollCalculator::compute(calcPolicy(), calcSlices(['other_allowances' => [['label' => 'Internet', 'amount' => 1000]], 'gross' => 101000], 7), calcFacts(['divisor' => 22, 'full_month' => false]));
    expect($r['gross'])->toBe((int) round(101000 * 7 / 22));
    $c = $r['components'];
    expect($c['basic'] + $c['house_rent'] + $c['medical'] + $c['conveyance'] + array_sum(array_column($c['other_allowances'], 'amount')))->toBe($r['gross'])
        ->and($c['other_allowances'][0]['label'])->toBe('Internet');
});

it('deducts loss of pay only when the switch is on', function () {
    $f = calcFacts(['absent_days' => 3, 'half_days' => 1, 'unpaid_leave_days' => 1]);
    $on = PayrollCalculator::compute(calcPolicy(), calcSlices(), $f);
    expect($on['unpaid_deduction'])->toBe((int) round(4.5 * 5000))->and($on['lop_days'])->toBe(4.5);
    $off = PayrollCalculator::compute(calcPolicy(['lop_enabled' => false]), calcSlices(), $f);
    expect($off['unpaid_deduction'])->toBe(0)->and($off['net'])->toBe(96000);
});

it('applies the late penalty with the monthly cap only when enabled', function () {
    $p = calcPolicy(['late_penalty_enabled' => true, 'lates_per_penalty' => 3, 'penalty_days' => 0.5, 'max_penalty_days_per_month' => 1]);
    expect(PayrollCalculator::compute($p, calcSlices(), calcFacts(['late_count' => 2]))['late_deduction'])->toBe(0)
        ->and(PayrollCalculator::compute($p, calcSlices(), calcFacts(['late_count' => 3]))['late_deduction'])->toBe(2500)
        ->and(PayrollCalculator::compute($p, calcSlices(), calcFacts(['late_count' => 30]))['late_penalty_days'])->toBe(1.0)
        ->and(PayrollCalculator::compute($p, calcSlices(), calcFacts(['late_count' => 30]))['late_deduction'])->toBe(5000)
        ->and(PayrollCalculator::compute(calcPolicy(), calcSlices(), calcFacts(['late_count' => 30]))['late_deduction'])->toBe(0);
});

it('computes PF on both sides only when enabled, structure percent overriding policy', function () {
    $p = calcPolicy(['pf_enabled' => true, 'pf_employee_percent' => 10, 'pf_employer_percent' => 10]);
    $r = PayrollCalculator::compute($p, calcSlices(['pf_percent' => 5]), calcFacts());
    expect($r['pf'])->toBe(2750)->and($r['pf_employer'])->toBe(5500)->and($r['net'])->toBe(100000 - 4000 - 2750);
    $o = PayrollCalculator::compute($p, calcSlices(['pf_employer_percent' => 0.0]), calcFacts());
    expect($o['pf'])->toBe(5500)->and($o['pf_employer'])->toBe(0);
    expect(PayrollCalculator::compute(calcPolicy(), calcSlices(['pf_percent' => 5]), calcFacts())['pf'])->toBe(0);
});

it('honours the tax switch', function () {
    expect(PayrollCalculator::compute(calcPolicy(['tax_enabled' => false]), calcSlices(), calcFacts())['tax'])->toBe(0);
});

it('pays overtime only when enabled, with the gross-derived hourly rate', function () {
    $f = calcFacts(['overtime_minutes' => 120]);
    expect(PayrollCalculator::compute(calcPolicy(), calcSlices(), $f)['overtime_pay'])->toBe(0);
    $r = PayrollCalculator::compute(calcPolicy(['overtime_enabled' => true, 'overtime_multiplier' => 1.5]), calcSlices(), $f);
    expect($r['overtime_pay'])->toBe((int) round(2 * (100000 / (20 * 8)) * 1.5));
});

it('adds adjustments to net', function () {
    $r = PayrollCalculator::compute(calcPolicy(), calcSlices(), calcFacts(), [['kind' => 'bonus', 'amount' => 2000], ['kind' => 'deduction', 'amount' => 500]]);
    expect($r['net'])->toBe(100000 + 2000 - 4000 - 500);
});

it('handles no slices and a zero divisor', function () {
    $r = PayrollCalculator::compute(calcPolicy(), [], calcFacts(['divisor' => 0, 'absent_days' => 2]));
    expect($r['gross'])->toBe(0)->and($r['unpaid_deduction'])->toBe(0);
});
