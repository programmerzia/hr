<?php

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\ActivityLogEntry;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;

function xrPresent($employee, int $y, int $m): void
{
    foreach (PayrollPeriod::workingDates($y, $m) as $d) {
        if ($d < now()->toDateString()) {
            AttendanceDay::firstOrCreate(['employee_id' => $employee->id, 'date' => $d], ['status' => 'ended', 'work_seconds' => 480 * 60]);
        }
    }
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->emp = makeUser('employee');
    foreach ([$this->hr, $this->mgmt, $this->emp] as $u) {
        SalaryStructure::create([
            'employee_id' => $u->employee_id, 'effective_from' => '2024-01-01', 'basic' => 55000, 'house_rent' => 25000,
            'medical' => 10000, 'conveyance' => 10000, 'pf_percent' => 5, 'tax_monthly' => 3000, 'gross' => 100000, 'hourly_rate' => 568,
        ]);
        BankAccount::create(['employee_id' => $u->employee_id, 'bank' => 'City', 'account_name' => $u->name, 'account_no' => '1234567890', 'routing_no' => '1', 'branch' => 'Main', 'is_primary' => true]);
        xrPresent($u->employee, 2026, 11);
    }
    $this->annual = LeaveType::create(['name' => 'Annual leave', 'annual_quota' => 14, 'is_paid' => true, 'carry_forward' => true, 'carry_forward_cap' => 7, 'allowed_on_probation' => false, 'encashable' => true, 'allows_half_day' => true]);
});

function xrFestival($t, string $label = 'Eid bonus', $pct = 50, int $month = 11)
{
    return $t->actingAs($t->hr)->post(route('payroll.runs.store'), ['kind' => 'festival', 'year' => 2026, 'month' => $month, 'bonus_percent_of_basic' => $pct, 'label' => $label]);
}

it('builds a festival run: percent of basic, no tax, pf or loss of pay', function () {
    xrFestival($this)->assertSessionHasNoErrors();
    $run = PayrollRun::where('kind', 'festival')->firstOrFail();
    expect($run->label)->toBe('Eid bonus')->and((float) $run->bonus_percent_of_basic)->toBe(50.0);
    $items = PayrollItem::where('run_id', $run->id)->get();
    expect($items)->toHaveCount(3);
    foreach ($items as $i) {
        expect($i->gross)->toBe(27500)->and($i->tax)->toBe(0)->and($i->pf)->toBe(0)->and($i->unpaid_deduction)->toBe(0)->and($i->net)->toBe(27500);
    }
});

it('applies adjustments to festival net and runs the same workflow with a bonus payslip', function () {
    xrFestival($this);
    $run = PayrollRun::where('kind', 'festival')->firstOrFail();
    $item = PayrollItem::where('run_id', $run->id)->where('employee_id', $this->emp->employee_id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'Extra', 'amount' => 1000]);
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'deduction', 'label' => 'Advance', 'amount' => 500]);
    expect($item->refresh()->net)->toBe(28000);

    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    expect(PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->count())->toBe(0);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasNoErrors();
    $this->actingAs($this->hr)->get(route('payroll.runs.bank-advice', $run))->assertOk()->assertHeader('Content-Disposition', 'attachment; filename="bank-advice-2026-11-festival-eid-bonus.csv"');
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'F1']);
    expect($run->refresh()->status)->toBe('paid');

    $item->refresh();
    expect($item->payslip_path)->not->toBeNull();
    $pdf = file_get_contents(storage_path('app/'.$item->payslip_path));
    expect(str_starts_with($pdf, '%PDF'))->toBeTrue();
    $this->actingAs($this->emp)->get(route('payroll.payslip.pdf', $item))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $this->actingAs($this->emp)->get(route('payroll.payslip', $item))->assertOk();
});

it('allows several festival runs a month only with different labels', function () {
    xrFestival($this, 'Eid bonus')->assertSessionHasNoErrors();
    xrFestival($this, ' eid BONUS ')->assertSessionHasErrors(['payroll' => 'A festival bonus run named "eid BONUS" already exists for November 2026.']);
    xrFestival($this, 'Puja bonus', 25)->assertSessionHasNoErrors();
    xrFestival($this, 'Eid bonus', 50, 12)->assertSessionHasNoErrors();
    expect(PayrollRun::where('kind', 'festival')->count())->toBe(3);
    // a regular run for the month is unaffected
    $this->actingAs($this->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11])->assertSessionHasNoErrors();
    expect(PayrollRun::where('kind', 'regular')->count())->toBe(1);
});

it('validates the festival percent and label and the ability', function () {
    xrFestival($this, 'X', 0)->assertSessionHasErrors('bonus_percent_of_basic');
    xrFestival($this, 'X', 201)->assertSessionHasErrors('bonus_percent_of_basic');
    xrFestival($this, '   ', 50)->assertSessionHasErrors('label');
    $this->actingAs($this->emp)->post(route('payroll.runs.store'), ['kind' => 'festival', 'year' => 2026, 'month' => 11, 'bonus_percent_of_basic' => 50, 'label' => 'A'])->assertForbidden();
});

/** emp resigned on Tue 10 Nov with 12 unused annual leave days. */
function xrExit($t): void
{
    $t->emp->employee->update(['status' => 'resigned', 'exited_on' => '2026-11-10']);
    LeaveBalance::create(['employee_id' => $t->emp->employee_id, 'leave_type_id' => $t->annual->id, 'year' => 2026, 'entitled' => 14, 'carried_in' => 0, 'used' => 2, 'pending' => 0]);
}

function xrSettle($t)
{
    return $t->actingAs($t->hr)->post(route('payroll.runs.store'), ['kind' => 'settlement', 'employee_id' => $t->emp->employee_id]);
}

it('prices a settlement: prorated salary, encashment, deductions and adjustments', function () {
    xrExit($this);
    xrSettle($this)->assertSessionHasNoErrors();
    $run = PayrollRun::where('kind', 'settlement')->firstOrFail();
    expect($run->year)->toBe(2026)->and($run->month)->toBe(11)->and($run->employee_id)->toBe($this->emp->employee_id);

    $month = count(PayrollPeriod::workingDates(2026, 11));
    $eligible = count(array_filter(PayrollPeriod::workingDates(2026, 11), fn ($d) => $d <= '2026-11-10'));
    $item = PayrollItem::where('run_id', $run->id)->firstOrFail();
    $daily = 100000 / $month;
    $gross = (int) round(100000 * $eligible / $month);
    expect($item->employee_id)->toBe($this->emp->employee_id)
        ->and($item->gross)->toBe($gross)
        ->and($item->leave_encashment)->toBe((int) round(12 * $daily))
        ->and($item->tax)->toBe(3000)->and($item->pf)->toBe(0)
        ->and($item->net)->toBe($gross + (int) round(12 * $daily) - $item->tax - $item->pf);
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'deduction', 'label' => 'Laptop not returned', 'amount' => 5000]);
    expect($item->refresh()->net)->toBe($gross + (int) round(12 * $daily) - 3000 - $item->pf - 5000);
});

it('consumes encashment on approve and blocks reopen', function () {
    xrExit($this);
    xrSettle($this);
    $run = PayrollRun::where('kind', 'settlement')->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasNoErrors();
    expect((float) LeaveBalance::where('employee_id', $this->emp->employee_id)->value('encashed'))->toBe(12.0);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.reopen', $run), ['reason' => 'oops'])->assertSessionHasErrors(['payroll' => 'Settlement runs cannot be reopened.']);
    expect($run->refresh()->status)->toBe('approved');

    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'S1']);
    $item = PayrollItem::where('run_id', $run->id)->firstOrFail();
    expect($item->leave_encashment)->toBeGreaterThan(0)->and(str_starts_with(file_get_contents(storage_path('app/'.$item->payslip_path)), '%PDF'))->toBeTrue();
    $this->actingAs($this->emp)->get(route('payroll.payslip.pdf', $item))->assertOk();
    $this->actingAs($this->emp)->get(route('payroll.payslip', $item))->assertOk();
});

it('leaves the exited employee out of the regular run of that month', function () {
    xrExit($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11]);
    $regular = PayrollRun::where('kind', 'regular')->firstOrFail();
    expect(PayrollItem::where('run_id', $regular->id)->where('employee_id', $this->emp->employee_id)->exists())->toBeTrue();

    xrSettle($this)->assertSessionHasNoErrors(); // open regular run is recomputed without them
    expect(PayrollItem::where('run_id', $regular->id)->where('employee_id', $this->emp->employee_id)->exists())->toBeFalse()
        ->and(PayrollItem::where('run_id', $regular->id)->count())->toBe(2);
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $regular));
    expect(ActivityLogEntry::where('subject_id', $regular->id)->where('description', 'like', 'left out%')->exists())->toBeTrue();
});

it('guards settlement creation', function () {
    xrSettle($this)->assertSessionHasErrors('payroll'); // still active
    xrExit($this);
    xrSettle($this)->assertSessionHasNoErrors();
    xrSettle($this)->assertSessionHasErrors(['payroll' => $this->emp->employee->name.' already has a final settlement run.']);
    $contractor = makeUser('employee', ['employment_type' => 'contractor', 'status' => 'resigned', 'exited_on' => '2026-11-05']);
    $this->actingAs($this->hr)->post(route('payroll.runs.store'), ['kind' => 'settlement', 'employee_id' => $contractor->employee_id])->assertSessionHasErrors('payroll');
});

it('lists exited employees without a settlement run on the runs page', function () {
    xrExit($this);
    $this->actingAs($this->hr)->get(route('payroll.runs'))->assertInertia(fn ($p) => $p->has('exited', 1)->where('exited.0.id', $this->emp->employee_id));
    xrSettle($this);
    $this->actingAs($this->hr)->get(route('payroll.runs'))->assertInertia(fn ($p) => $p->has('exited', 0));
});
