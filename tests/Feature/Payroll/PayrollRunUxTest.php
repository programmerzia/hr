<?php

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;

function uxPresent($employee, int $y, int $m): void
{
    foreach (PayrollPeriod::workingDates($y, $m) as $d) {
        if ($d < now()->toDateString()) {
            AttendanceDay::create(['employee_id' => $employee->id, 'date' => $d, 'status' => 'ended', 'work_seconds' => 480 * 60]);
        }
    }
}

/** A paid October run whose item for the employee has the given net. */
function uxPriorPaid($employee, int $net): void
{
    $run = PayrollRun::firstOrCreate(['year' => 2026, 'month' => 10, 'kind' => 'regular'], ['status' => 'paid', 'paid_at' => now()]);
    PayrollItem::create(['run_id' => $run->id, 'employee_id' => $employee->id, 'salary_structure_id' => $employee->salaryStructures()->value('id'), 'net' => $net, 'gross' => $net]);
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->emp = makeUser('employee');
    foreach ([$this->hr, $this->mgmt, $this->emp] as $u) {
        SalaryStructure::create([
            'employee_id' => $u->employee_id, 'effective_from' => '2024-01-01', 'basic' => 55000, 'house_rent' => 25000,
            'medical' => 10000, 'conveyance' => 10000, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 100000, 'hourly_rate' => 568,
        ]);
        BankAccount::create(['employee_id' => $u->employee_id, 'bank' => 'City', 'account_name' => $u->name, 'account_no' => '1234567890', 'routing_no' => '1', 'branch' => 'Main', 'is_primary' => true]);
        uxPresent($u->employee, 2026, 11);
    }
    // hr and mgmt were paid the same last month (no flag); emp was paid half (up 100%).
    uxPriorPaid($this->hr->employee, 100000);
    uxPriorPaid($this->mgmt->employee, 100000);
});

function uxDraft($t): PayrollRun
{
    $t->actingAs($t->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11]);

    return PayrollRun::where('month', 11)->firstOrFail();
}

function uxItem($t, $user): PayrollItem
{
    return PayrollItem::where('employee_id', $user->employee_id)->whereHas('run', fn ($q) => $q->where('month', 11))->firstOrFail();
}

it('flags variance on submit: up, new and none', function () {
    $prior = PayrollRun::where('month', 10)->firstOrFail();
    PayrollItem::where('run_id', $prior->id)->where('employee_id', $this->mgmt->employee_id)->update(['net' => 150000]); // now down 33%
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));

    $hr = uxItem($this, $this->hr);
    $mgmt = uxItem($this, $this->mgmt);
    expect($hr->variance_flag)->toBeFalse()->and($hr->variance_kind)->toBe('none')
        ->and($mgmt->variance_flag)->toBeTrue()->and($mgmt->variance_kind)->toBe('down')->and((float) $mgmt->variance_pct)->toBe(-33.33);
});

it('flags a new payee and an increase', function () {
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    expect(uxItem($this, $this->emp)->variance_kind)->toBe('new');

    PayrollItem::where('employee_id', $this->hr->employee_id)->whereHas('run', fn ($q) => $q->where('month', 10))->update(['net' => 50000]);
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run));
    $hr = uxItem($this, $this->hr);
    expect($hr->variance_kind)->toBe('up')->and((float) $hr->variance_pct)->toBe(100.0);
});

it('blocks approval until every flagged item is acknowledged', function () {
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $flagged = uxItem($this, $this->emp);
    expect($flagged->variance_flag)->toBeTrue();

    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))
        ->assertSessionHasErrors(['payroll' => 'Acknowledge all flagged items before approving.']);
    expect($run->refresh()->status)->toBe('review');

    $this->actingAs($this->emp)->post(route('payroll.items.ack-variance', $flagged))->assertForbidden();
    $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', $flagged))->assertSessionHas('success');
    $flagged->refresh();
    expect($flagged->variance_ack_by)->toBe($this->hr->employee_id)->and($flagged->variance_ack_at)->not->toBeNull();

    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasNoErrors();
    expect($run->refresh()->status)->toBe('approved');
});

it('lets approval pass when the flagged item is on hold', function () {
    $run = uxDraft($this);
    $flagged = uxItem($this, $this->emp);
    $this->actingAs($this->hr)->post(route('payroll.items.hold', $flagged), ['reason' => 'Bank details']);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    expect($flagged->refresh()->variance_flag)->toBeFalse();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasNoErrors();
});

it('refuses acknowledgement outside review and for unflagged items', function () {
    $run = uxDraft($this);
    $flagged = uxItem($this, $this->emp);
    $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', $flagged))->assertSessionHasErrors('payroll');
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', uxItem($this, $this->hr)))->assertSessionHasErrors('payroll');
});

it('clears acknowledgements on recompute', function () {
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $flagged = uxItem($this, $this->emp);
    $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', $flagged));
    expect($flagged->refresh()->variance_ack_at)->not->toBeNull();
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run));
    $flagged->refresh();
    expect($flagged->variance_flag)->toBeTrue()->and($flagged->variance_ack_at)->toBeNull()->and($flagged->variance_ack_by)->toBeNull();
});

function uxPay($t): PayrollRun
{
    $run = uxDraft($t);
    $t->actingAs($t->hr)->post(route('payroll.runs.submit', $run));
    PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->get()->each(fn ($i) => $t->actingAs($t->hr)->post(route('payroll.items.ack-variance', $i)));
    $t->actingAs($t->mgmt)->post(route('payroll.runs.approve', $run));
    $t->actingAs($t->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'B1']);

    return $run->refresh();
}

it('stores real payslip PDFs on pay and serves them to owner and staff only', function () {
    $run = uxPay($this);
    expect($run->status)->toBe('paid');
    $mine = uxItem($this, $this->emp);
    $path = storage_path('app/'.$mine->payslip_path);
    expect($mine->payslip_path)->toBe('payslips/'.$run->id.'/'.$this->emp->employee->code.'.pdf')->and(is_file($path))->toBeTrue()
        ->and(substr(file_get_contents($path), 0, 4))->toBe('%PDF');

    $res = $this->actingAs($this->emp)->get(route('payroll.payslip.pdf', $mine))->assertOk();
    expect($res->headers->get('content-type'))->toContain('application/pdf');
    $this->actingAs($this->hr)->get(route('payroll.payslip.pdf', $mine))->assertOk();
    $this->actingAs($this->emp)->get(route('payroll.payslip.pdf', uxItem($this, $this->hr)))->assertForbidden();

    // Lazy regeneration when the file is missing.
    unlink($path);
    $this->actingAs($this->emp)->get(route('payroll.payslip.pdf', $mine))->assertOk();
    expect(is_file($path))->toBeTrue();
});

it('notifies employees on paid and sends held items to an HR summary', function () {
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.items.hold', uxItem($this, $this->emp)), ['reason' => 'Bank']);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run));
    $this->hr->notifications()->delete();
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-30', 'reference' => 'B1']);

    $titles = fn ($u) => $u->notifications()->get()->pluck('data.title')->all();
    expect($titles($this->mgmt))->toContain('Your payslip for November 2026 is ready')
        ->and($this->mgmt->notifications()->get()->firstWhere('data.title', 'Your payslip for November 2026 is ready')->data['link'])->toBe('/payslips')
        ->and($titles($this->emp))->toBe([])
        ->and(collect($titles($this->hr))->contains(fn ($t) => str_contains($t, 'on hold')))->toBeTrue();
});

it('exposes kind and variance on the pages', function () {
    $run = uxDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run));
    $this->actingAs($this->hr)->get(route('payroll.runs.show', $run))
        ->assertInertia(fn ($p) => $p->component('Payroll/RunDetailPage', false)->has('items.0.variance_kind')->has('items.0.variance_flag'));
    $this->actingAs($this->hr)->get(route('payroll.runs'))
        ->assertInertia(fn ($p) => $p->component('Payroll/RunsPage', false)->where('runs.0.kind', 'regular')->where('runs.0.totals.held', 0));
});
