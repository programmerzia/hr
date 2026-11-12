<?php

use App\Domain\Payroll\Services\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollFacts;
use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\BankAccount;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\PfLedger;
use App\Models\SalaryStructure;

function puStructure($employee, string $from = '2024-01-01', int $gross = 100000, array $over = []): SalaryStructure
{
    $basic = (int) round($gross * 0.55);

    return SalaryStructure::create([
        'employee_id' => $employee->id, 'effective_from' => $from, 'basic' => $basic, 'house_rent' => (int) round($gross * 0.25),
        'medical' => (int) round($gross * 0.1), 'conveyance' => $gross - $basic - (int) round($gross * 0.25) - (int) round($gross * 0.1),
        'pf_percent' => 0, 'tax_monthly' => 4000, 'gross' => $gross, 'hourly_rate' => 0, ...$over,
    ]);
}

/** Present on every past working date of the month, except the listed dates. */
function puPresent($employee, int $y, int $m, array $except = []): void
{
    foreach (PayrollPeriod::workingDates($y, $m) as $d) {
        if ($d < now()->toDateString() && ! in_array($d, $except, true)) {
            AttendanceDay::create(['employee_id' => $employee->id, 'date' => $d, 'status' => 'ended', 'work_seconds' => 480 * 60]);
        }
    }
}

function puPrice($employee, int $y, int $m, ?PayrollPolicy $policy = null): array
{
    $policy ??= PayrollPolicy::current();
    $facts = PayrollFacts::for($employee->fresh(), $y, $m, AttendancePolicy::current(), $policy);

    return [...PayrollCalculator::compute($policy, $facts['slices'], $facts), 'facts' => $facts];
}

function puPolicy(array $over): PayrollPolicy
{
    $p = PayrollPolicy::current();
    $p->update($over);

    return $p->refresh();
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->emp = makeUser('employee');
    $this->october = PayrollPeriod::workingDates(2026, 10);
});

it('pays a full-month employee exactly gross under every daily rate basis', function (string $basis) {
    puStructure($this->emp->employee, gross: 100001);
    puPresent($this->emp->employee, 2026, 10);
    $r = puPrice($this->emp->employee, 2026, 10, puPolicy(['daily_rate_basis' => $basis]));
    expect($r['gross'])->toBe(100001)->and($r['unpaid_deduction'])->toBe(0)->and($r['net'])->toBe(100001 - 4000);
})->with(['working_days', 'calendar_days', 'fixed_30', 'fixed_26']);

it('prorates a joiner on the 25th', function () {
    $this->emp->employee->update(['joined_on' => '2026-10-25']);
    puStructure($this->emp->employee, '2026-10-25');
    puPresent($this->emp->employee, 2026, 10);
    $units = count(array_filter($this->october, fn ($d) => $d >= '2026-10-25'));
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['eligible_days'])->toBe((float) $units)->and($r['gross'])->toBe((int) round(100000 * $units / count($this->october)))
        ->and($r['absent_days'])->toBe(0.0);

    $cal = puPrice($this->emp->employee, 2026, 10, puPolicy(['daily_rate_basis' => 'calendar_days']));
    expect($cal['gross'])->toBe((int) round(100000 * 7 / 31));
});

it('prorates a leaver on the 10th', function () {
    $this->emp->employee->update(['exited_on' => '2026-10-10']);
    puStructure($this->emp->employee);
    puPresent($this->emp->employee, 2026, 10);
    $units = count(array_filter($this->october, fn ($d) => $d <= '2026-10-10'));
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['gross'])->toBe((int) round(100000 * $units / count($this->october)))->and($r['eligible_days'])->toBe((float) $units);
});

it('splits a raise effective on the 16th into two slices', function () {
    puStructure($this->emp->employee);
    puStructure($this->emp->employee, '2026-10-16', 120000);
    puPresent($this->emp->employee, 2026, 10);
    $r = puPrice($this->emp->employee, 2026, 10);
    $before = count(array_filter($this->october, fn ($d) => $d < '2026-10-16'));
    $after = count($this->october) - $before;
    $wd = count($this->october);
    expect($r['slices'])->toHaveCount(2)
        ->and($r['slices'][0]['gross_share'])->toBe((int) round(100000 * $before / $wd))
        ->and($r['slices'][1]['gross_share'])->toBe((int) round(120000 * $after / $wd))
        ->and($r['gross'])->toBe($r['slices'][0]['gross_share'] + $r['slices'][1]['gross_share']);
    $c = $r['components'];
    expect($c['basic'] + $c['house_rent'] + $c['medical'] + $c['conveyance'])->toBe($r['gross']);
});

it('deducts three unapproved absences at the daily rate only when LOP is on', function () {
    puStructure($this->emp->employee);
    $absent = array_slice($this->october, 3, 3);
    puPresent($this->emp->employee, 2026, 10, $absent);
    foreach ($absent as $d) {
        AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $d, 'status' => 'absent', 'day_fraction' => 0, 'absence_kind' => 'unapproved']);
    }
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['absent_days'])->toBe(3.0)->and($r['unpaid_deduction'])->toBe((int) round(3 * 100000 / count($this->october)));
    expect(puPrice($this->emp->employee, 2026, 10, puPolicy(['lop_enabled' => false]))['unpaid_deduction'])->toBe(0);
});

it('counts a missing past working day as absent and a future day as full', function () {
    puStructure($this->emp->employee);
    $missing = $this->october[5];
    puPresent($this->emp->employee, 2026, 10, [$missing]);
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['absent_days'])->toBe(1.0)->and($r['day_fraction_total'])->toBe((float) count($this->october) - 1);

    // November: today is the 12th; no rows after today must not cost anything.
    puPresent($this->emp->employee, 2026, 11);
    $nov = puPrice($this->emp->employee, 2026, 11);
    expect($nov['absent_days'])->toBe(0.0)->and($nov['gross'])->toBe(100000);
});

it('does not price an open, not yet closed day as an absence', function () {
    puStructure($this->emp->employee);
    puPresent($this->emp->employee, 2026, 11);
    // Today's row as StartWork leaves it at 10:00: working, graded 0 so far, not closed by the nightly job.
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => '2026-11-12', 'status' => 'working', 'work_seconds' => 0, 'day_fraction' => 0, 'absence_kind' => 'unapproved']);
    $nov = puPrice($this->emp->employee, 2026, 11);
    expect($nov['absent_days'])->toBe(0.0)->and($nov['unpaid_deduction'])->toBe(0);

    // Once the nightly job closes it (closed_at set) the grade counts.
    AttendanceDay::where('employee_id', $this->emp->employee_id)->whereDate('date', '2026-11-12')->update(['status' => 'ended', 'closed_at' => now()]);
    expect(puPrice($this->emp->employee, 2026, 11)['absent_days'])->toBe(1.0);
});

it('treats half days, excused and paid-leave rows correctly', function () {
    puStructure($this->emp->employee);
    [$a, $b, $c] = array_slice($this->october, 0, 3);
    puPresent($this->emp->employee, 2026, 10, [$a, $b, $c]);
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $a, 'status' => 'ended', 'day_fraction' => 0.5, 'absence_kind' => 'half_day']);
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $b, 'status' => 'absent', 'day_fraction' => 0, 'absence_kind' => 'excused']);
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $c, 'status' => 'on_leave', 'day_fraction' => 0, 'absence_kind' => 'paid_leave']);
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['half_days'])->toBe(1.0)->and($r['absent_days'])->toBe(0.0)->and($r['paid_leave_days'])->toBe(1.0)->and($r['lop_days'])->toBe(0.5);
});

it('counts unregularised lates and early leaves for the late penalty', function () {
    puStructure($this->emp->employee);
    puPresent($this->emp->employee, 2026, 10);
    $days = AttendanceDay::where('employee_id', $this->emp->employee_id)->orderBy('date')->get();
    $days[0]->update(['late_minutes' => 20]);
    $days[1]->update(['late_minutes' => 20, 'is_regularized' => true]);
    $days[2]->update(['early_minutes' => 40]);
    $days[3]->update(['late_minutes' => 30]);
    expect(puPrice($this->emp->employee, 2026, 10)['late_count'])->toBe(3)
        ->and(puPrice($this->emp->employee, 2026, 10)['late_deduction'])->toBe(0);
    $on = puPrice($this->emp->employee, 2026, 10, puPolicy(['late_penalty_enabled' => true]));
    expect($on['late_penalty_days'])->toBe(0.5)->and($on['late_deduction'])->toBe((int) round(0.5 * 100000 / count($this->october)));
});

it('honours the tax switch end to end', function () {
    puStructure($this->emp->employee);
    puPresent($this->emp->employee, 2026, 10);
    expect(puPrice($this->emp->employee, 2026, 10)['tax'])->toBe(4000)
        ->and(puPrice($this->emp->employee, 2026, 10, puPolicy(['tax_enabled' => false]))['tax'])->toBe(0);
});

/* Workflow */

function puRun($t, int $m = 11): PayrollRun
{
    $t->actingAs($t->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => $m])->assertSessionDoesntHaveErrors();

    return PayrollRun::where('month', $m)->firstOrFail();
}

function puApprove($t, PayrollRun $run): PayrollRun
{
    $t->actingAs($t->hr)->post(route('payroll.runs.submit', $run))->assertSessionDoesntHaveErrors();
    PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->get()->each(fn ($i) => $t->actingAs($t->hr)->post(route('payroll.items.ack-variance', $i)));
    $t->actingAs($t->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionDoesntHaveErrors();

    return $run->refresh();
}

function puStaff($t, array $structure = []): void
{
    foreach ([$t->hr, $t->mgmt, $t->emp] as $u) {
        puStructure($u->employee, over: $structure);
        BankAccount::create(['employee_id' => $u->employee_id, 'bank' => 'City Bank', 'account_name' => $u->name, 'account_no' => '0012345', 'routing_no' => '225261741', 'branch' => 'Motijheel', 'is_primary' => true]);
        foreach ([10, 11] as $m) {
            puPresent($u->employee, 2026, $m);
        }
    }
}

it('writes no PF and no ledger rows by default', function () {
    puStaff($this, ['pf_percent' => 5]);
    $run = puApprove($this, puRun($this));
    expect(PayrollItem::where('run_id', $run->id)->sum('pf'))->toBe(0)->and(PfLedger::count())->toBe(0)
        ->and(PayrollItem::where('run_id', $run->id)->whereNull('snapshot_at')->count())->toBe(0)
        ->and(PayrollItem::where('run_id', $run->id)->first()->payroll_policy_id)->toBe(PayrollPolicy::current()->id);
});

it('writes PF for both sides with a cumulative ledger when enabled', function () {
    puStaff($this);
    puPolicy(['pf_enabled' => true, 'pf_employee_percent' => 10, 'pf_employer_percent' => 8]);
    $oct = puApprove($this, puRun($this, 10));
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $oct), ['paid_on' => '2026-10-31', 'reference' => 'R1']);
    puApprove($this, puRun($this, 11));
    $item = PayrollItem::where('employee_id', $this->emp->employee_id)->where('run_id', $oct->id)->first();
    expect($item->pf)->toBe(5500)->and($item->pf_employer)->toBe(4400);
    $rows = PfLedger::where('employee_id', $this->emp->employee_id)->orderBy('month')->get();
    expect($rows)->toHaveCount(2)->and($rows[1]->cumulative_employee)->toBe(11000)->and($rows[1]->cumulative_employer)->toBe(8800);
});

it('rejects recompute, adjustments and holds on a locked run', function () {
    puStaff($this);
    $run = puRun($this);
    $item = PayrollItem::where('run_id', $run->id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'x', 'amount' => 10]);
    $run->update(['locked_at' => now()]); // locked even while still a draft
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run))->assertSessionHasErrors('payroll');
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'y', 'amount' => 10])->assertSessionHasErrors(['payroll' => 'This run is locked.']);
    $this->actingAs($this->hr)->delete(route('payroll.adjustments.destroy', PayrollAdjustment::firstOrFail()))->assertSessionHasErrors('payroll');
    $this->actingAs($this->hr)->post(route('payroll.items.hold', $item), ['reason' => 'Docs'])->assertSessionHasErrors(['payroll' => 'This run is locked.']);
    $this->actingAs($this->hr)->post(route('payroll.items.unhold', $item))->assertSessionHasErrors('payroll');
    $this->actingAs($this->hr)->postJson(route('payroll.items.hold', $item), ['reason' => 'Docs'])->assertStatus(422);
    expect($item->refresh()->hold)->toBeFalse();
});

it('holds an item out of totals and the bank file', function () {
    puStaff($this);
    $run = puRun($this);
    $item = PayrollItem::where('run_id', $run->id)->where('employee_id', $this->emp->employee_id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.items.hold', $item), ['reason' => ''])->assertSessionHasErrors('reason');
    $this->actingAs($this->emp)->post(route('payroll.items.hold', $item), ['reason' => 'x'])->assertForbidden();
    $this->actingAs($this->hr)->post(route('payroll.items.hold', $item), ['reason' => 'Bank details missing'])->assertSessionHas('success');
    expect($item->refresh()->hold)->toBeTrue()->and($item->hold_reason)->toBe('Bank details missing');
    $this->actingAs($this->hr)->get(route('payroll.runs.show', $run))
        ->assertInertia(fn ($p) => $p->where('totals.employees', 2)->where('totals.held', 1)->where('totals.net', 2 * 96000)->has('policy'));
    puApprove($this, $run);
    $csv = $this->actingAs($this->hr)->get(route('payroll.runs.bank-advice', $run))->assertOk()->getContent();
    expect($csv)->not->toContain($this->emp->employee->code);
});

it('exports the bank advice for approved runs to payroll roles only', function () {
    puStaff($this);
    $run = puRun($this);
    $this->actingAs($this->hr)->get(route('payroll.runs.bank-advice', $run))->assertNotFound();
    puApprove($this, $run);
    $res = $this->actingAs($this->hr)->get(route('payroll.runs.bank-advice', $run))->assertOk();
    expect($res->headers->get('content-type'))->toContain('text/csv');
    $lines = array_values(array_filter(explode("\n", $res->getContent())));
    expect($lines[0])->toBe('code,name,bank,branch,account_name,account_no,routing_no,net')->and($lines)->toHaveCount(4);
    $code = $this->emp->employee->code;
    $row = collect($lines)->first(fn ($l) => str_starts_with($l, $code.','));
    expect(str_getcsv($row, escape: ''))->toBe(array_map('strval', [$code, $this->emp->name, 'City Bank', 'Motijheel', $this->emp->name, '0012345', '225261741', 96000]));
    $this->actingAs($this->mgmt)->get(route('payroll.runs.bank-advice', $run))->assertOk();
    $this->actingAs($this->emp)->get(route('payroll.runs.bank-advice', $run))->assertForbidden();
});

it('reopens an approved run back to review for management only', function () {
    puStaff($this);
    puPolicy(['pf_enabled' => true, 'pf_employee_percent' => 5]);
    $run = puApprove($this, puRun($this));
    expect(PfLedger::where('run_id', $run->id)->count())->toBe(3);
    $this->actingAs($this->hr)->post(route('payroll.runs.reopen', $run), ['reason' => 'x'])->assertForbidden();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.reopen', $run), ['reason' => ''])->assertSessionHasErrors('reason');
    $this->actingAs($this->mgmt)->post(route('payroll.runs.reopen', $run), ['reason' => 'Missed a bonus'])->assertSessionHas('success');
    $run->refresh();
    expect($run->status)->toBe('review')->and($run->locked_at)->toBeNull()->and($run->approved_by)->toBeNull()
        ->and($run->reopen_reason)->toBe('Missed a bonus')->and($run->reopened_by)->toBe($this->mgmt->employee_id)
        ->and(PfLedger::where('run_id', $run->id)->count())->toBe(0);
    $item = PayrollItem::where('run_id', $run->id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'Bonus', 'amount' => 100])->assertSessionDoesntHaveErrors();

    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run));
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'R']);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.reopen', $run), ['reason' => 'late'])->assertSessionHasErrors('payroll');
});

it('backfills snapshots for legacy items idempotently', function () {
    puStaff($this);
    $run = puApprove($this, puRun($this));
    PayrollItem::query()->update(['components' => null, 'slices' => null, 'payroll_policy_id' => null, 'attendance_policy_id' => null, 'snapshot_at' => null]);
    $this->artisan('payroll:backfill-snapshots')->assertSuccessful();
    $item = PayrollItem::where('employee_id', $this->emp->employee_id)->firstOrFail();
    expect($item->components['basic'])->toBe(55000)->and($item->slices)->toHaveCount(1)->and($item->payroll_policy_id)->not->toBeNull()
        ->and($item->snapshot_at)->not->toBeNull();
    $before = PayrollItem::orderBy('id')->get()->map(fn ($i) => [$i->components, $i->slices, (string) $i->updated_at])->all();
    $this->artisan('payroll:backfill-snapshots')->expectsOutput('Backfilled 0 payroll items.')->assertSuccessful();
    expect(PayrollItem::orderBy('id')->get()->map(fn ($i) => [$i->components, $i->slices, (string) $i->updated_at])->all())->toBe($before);
});

it('renders the payslip from the item snapshot', function () {
    puStaff($this);
    $run = puRun($this);
    $item = PayrollItem::where('run_id', $run->id)->where('employee_id', $this->emp->employee_id)->firstOrFail();
    $this->actingAs($this->hr)->get(route('payroll.payslip', $item))
        ->assertInertia(fn ($p) => $p->component('Payroll/PayslipPage', false)->where('item.components.basic', 55000)->has('item.slices', 1)->where('policy.pf_enabled', false));
});

it('does not double-deduct approved unpaid leave on a graded row, and ignores weekend/holiday rows', function () {
    puStructure($this->emp->employee);
    [$a, $b] = array_slice($this->october, 0, 2);
    puPresent($this->emp->employee, 2026, 10, [$a, $b]);
    $type = LeaveType::create(['name' => 'Unpaid', 'is_paid' => false]);
    LeaveRequest::create(['employee_id' => $this->emp->employee_id, 'leave_type_id' => $type->id, 'starts_on' => $a, 'ends_on' => $a, 'days' => 1, 'reason' => 'x', 'status' => 'approved']);
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $a, 'status' => 'on_leave', 'day_fraction' => 0, 'absence_kind' => 'unpaid_leave']);
    AttendanceDay::create(['employee_id' => $this->emp->employee_id, 'date' => $b, 'status' => 'holiday', 'day_fraction' => 1, 'absence_kind' => 'holiday']);
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['unpaid_leave_days'])->toBe(1.0)->and($r['absent_days'])->toBe(0.0)->and($r['lop_days'])->toBe(1.0)
        ->and($r['unpaid_deduction'])->toBe((int) round(100000 / count($this->october)));
});

it('uses leave requests only for dates without a row (fallback path)', function () {
    puStructure($this->emp->employee);
    $a = $this->october[2];
    puPresent($this->emp->employee, 2026, 10, [$a]);
    $type = LeaveType::create(['name' => 'Annual', 'is_paid' => true]);
    LeaveRequest::create(['employee_id' => $this->emp->employee_id, 'leave_type_id' => $type->id, 'starts_on' => $a, 'ends_on' => $a, 'days' => 1, 'reason' => 'x', 'status' => 'approved']);
    $r = puPrice($this->emp->employee, 2026, 10);
    expect($r['paid_leave_days'])->toBe(1.0)->and($r['absent_days'])->toBe(0.0)->and($r['lop_days'])->toBe(0.0);
});

it('stores employer PF override and other allowances on a new structure', function () {
    puStructure($this->emp->employee);
    $this->actingAs($this->hr)->post(route('people.salary', $this->emp->employee), [
        'effective_from' => '2026-12-01', 'basic' => 55000, 'house_rent' => 25000, 'medical' => 10000, 'conveyance' => 10000,
        'pf_percent' => 0, 'tax_monthly' => 0, 'pf_employer_percent' => 8, 'other_allowances' => [['label' => 'Internet', 'amount' => 1500]],
    ])->assertSessionDoesntHaveErrors();
    $s = SalaryStructure::where('employee_id', $this->emp->employee_id)->orderByDesc('effective_from')->first();
    expect($s->gross)->toBe(101500)->and($s->pf_employer_percent)->toBe(8.0)->and($s->otherAllowances())->toBe([['label' => 'Internet', 'amount' => 1500]]);
    $this->actingAs($this->hr)->post(route('people.salary', $this->emp->employee), [
        'effective_from' => '2027-01-01', 'basic' => 1, 'house_rent' => 0, 'medical' => 0, 'conveyance' => 0, 'pf_percent' => 0, 'tax_monthly' => 0,
        'pf_employer_percent' => 300,
    ])->assertSessionHasErrors('pf_employer_percent');
});
