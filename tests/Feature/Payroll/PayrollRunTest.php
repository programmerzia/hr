<?php

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Support\Badges;
use App\Models\ActivityLogEntry;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;
use Inertia\Testing\AssertableInertia as Assert;

/** Attendance rows for every past working date of the month (so the fallback-absent rule does not fire). */
function presentFor($employee, int $y, int $m, array $except = []): void
{
    foreach (PayrollPeriod::workingDates($y, $m) as $d) {
        if ($d < now()->toDateString() && ! in_array($d, $except, true)) {
            AttendanceDay::create(['employee_id' => $employee->id, 'date' => $d, 'status' => 'ended', 'work_seconds' => 480 * 60]);
        }
    }
}

function salaryFor($employee, int $gross = 100000): SalaryStructure
{
    return SalaryStructure::create([
        'employee_id' => $employee->id, 'effective_from' => '2024-01-01', 'basic' => 55000, 'house_rent' => 25000,
        'medical' => 10000, 'conveyance' => $gross - 90000, 'pf_percent' => 5, 'tax_monthly' => 4000, 'gross' => $gross, 'hourly_rate' => 568,
    ]);
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->emp = makeUser('employee');
    $this->other = makeUser('employee');
    $this->contractor = makeUser('employee', ['employment_type' => 'contractor']);
    $this->intern = makeUser('employee', ['employment_type' => 'intern']);
    foreach ([$this->hr, $this->mgmt, $this->emp, $this->other, $this->contractor, $this->intern] as $u) {
        salaryFor($u->employee);
        BankAccount::create(['employee_id' => $u->employee_id, 'bank' => 'City', 'account_name' => $u->name, 'account_no' => '1234567890', 'routing_no' => '1', 'branch' => 'Main', 'is_primary' => true]);
        presentFor($u->employee, 2026, 11);
    }
});

function draftRun($t): PayrollRun
{
    $t->actingAs($t->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11])->assertSessionDoesntHaveErrors();

    return PayrollRun::firstOrFail();
}

function paidRun($t): PayrollRun
{
    $run = PayrollRun::first() ?? draftRun($t);
    $t->actingAs($t->hr)->post(route('payroll.runs.submit', $run));
    $t->actingAs($t->mgmt)->post(route('payroll.runs.approve', $run));
    $t->actingAs($t->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'BEFTN-1']);

    return $run->refresh();
}

it('drafts a run for eligible full-time people only', function () {
    $run = draftRun($this);
    $ids = PayrollItem::where('run_id', $run->id)->pluck('employee_id');
    expect($run->status)->toBe('draft')->and($ids)->toHaveCount(4)
        ->and($ids)->not->toContain($this->contractor->employee_id)->not->toContain($this->intern->employee_id);
    expect(ActivityLogEntry::where('subject_id', $run->id)->pluck('description')->all())->toBe(['started the run']);
    $this->actingAs($this->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11])->assertSessionHasErrors('payroll');
});

it('renders runs and the run detail for payroll roles only', function () {
    $run = draftRun($this);
    $this->actingAs($this->hr)->get(route('payroll.runs'))
        ->assertInertia(fn (Assert $p) => $p->component('Payroll/RunsPage', false)->has('runs', 1)->where('runs.0.totals.employees', 4));
    $this->actingAs($this->hr)->get(route('payroll.runs.show', $run))
        ->assertInertia(fn (Assert $p) => $p->component('Payroll/RunDetailPage', false)->has('items', 4)->has('events', 1)->has('mix', 5)->has('totals'));
    $this->actingAs($this->emp)->get(route('payroll.runs'))->assertForbidden();
    $this->actingAs($this->emp)->get(route('payroll.runs.show', $run))->assertForbidden();
});

it('lets HR submit but not approve, and notifies management', function () {
    $run = draftRun($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run))->assertSessionHas('success');
    expect($run->refresh()->status)->toBe('review')
        ->and($this->mgmt->notifications()->first()->data['kind'])->toBe('payroll');
    $this->actingAs($this->hr)->post(route('payroll.runs.approve', $run))->assertForbidden();
    expect($run->refresh()->status)->toBe('review');
});

it('approves, locks adjustments and notifies HR', function () {
    $run = draftRun($this);
    $item = PayrollItem::where('run_id', $run->id)->where('employee_id', $this->emp->employee_id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'Spot bonus', 'amount' => 5000]);
    expect($item->refresh()->net)->toBe(100000 + 5000 - 4000); // PF is off by default
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHas('success');
    $run->refresh();
    expect($run->status)->toBe('approved')->and($run->locked_at)->not->toBeNull()->and($run->approved_by)->toBe($this->mgmt->employee_id)
        ->and($this->hr->notifications()->count())->toBe(1);

    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'Late', 'amount' => 1])
        ->assertSessionHasErrors(['payroll' => 'This run is locked.']);
    $adj = PayrollAdjustment::firstOrFail();
    $this->actingAs($this->hr)->delete(route('payroll.adjustments.destroy', $adj))->assertSessionHasErrors(['payroll' => 'This run is locked.']);
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run))->assertSessionHasErrors('payroll');
    expect(PayrollAdjustment::count())->toBe(1);
});

it('validates and removes adjustments on an open run', function () {
    $run = draftRun($this);
    $item = PayrollItem::where('run_id', $run->id)->firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => '', 'amount' => 10])
        ->assertSessionHasErrors(['payroll' => 'Add a label.']);
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'bonus', 'label' => 'x', 'amount' => 0])
        ->assertSessionHasErrors(['payroll' => 'Enter an amount greater than zero.']);
    $this->actingAs($this->hr)->post(route('payroll.adjustments.store', $item), ['kind' => 'deduction', 'label' => 'Fine', 'amount' => 1000]);
    $before = $item->refresh()->net;
    $this->actingAs($this->hr)->delete(route('payroll.adjustments.destroy', PayrollAdjustment::firstOrFail()));
    expect($item->refresh()->net)->toBe($before + 1000)
        ->and(ActivityLogEntry::where('subject_id', $run->id)->count())->toBe(3);
});

it('marks an approved run as paid and exposes payslips to the owner only', function () {
    $run = draftRun($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'R1'])
        ->assertSessionHasErrors('payroll');
    $run = paidRun($this);
    expect($run->status)->toBe('paid')->and($run->payment_reference)->toBe('BEFTN-1')->and($run->paid_at)->not->toBeNull();
    $mine = PayrollItem::where('employee_id', $this->emp->employee_id)->firstOrFail();
    $theirs = PayrollItem::where('employee_id', $this->other->employee_id)->firstOrFail();
    expect($mine->payslip_path)->not->toBeNull();

    $this->actingAs($this->emp)->get(route('payroll.payslip', $mine))
        ->assertInertia(fn (Assert $p) => $p->component('Payroll/PayslipPage', false)->where('item.id', $mine->id)->where('staff', false)->has('salary')->has('bank'));
    $this->actingAs($this->emp)->get(route('payroll.payslip', $theirs))->assertForbidden();
    $this->actingAs($this->hr)->get(route('payroll.payslip', $theirs))->assertOk();
    $this->actingAs($this->emp)->get(route('payroll.mine'))
        ->assertInertia(fn (Assert $p) => $p->component('Payroll/MyPayslipsPage', false)->has('slips', 1));
    $this->actingAs($this->contractor)->get(route('payroll.mine'))->assertForbidden();
});

it('hides the payslip of an unpaid run from its owner', function () {
    draftRun($this);
    $mine = PayrollItem::where('employee_id', $this->emp->employee_id)->firstOrFail();
    $this->actingAs($this->emp)->get(route('payroll.payslip', $mine))->assertForbidden();
});

it('badges runs awaiting the viewer', function () {
    $run = draftRun($this);
    expect(Badges::for($this->hr)['payroll'])->toBe(1)
        ->and(Badges::for($this->mgmt)['payroll'])->toBe(0);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    expect(Badges::for($this->mgmt)['payroll'])->toBe(1);
});
