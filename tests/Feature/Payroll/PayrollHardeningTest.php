<?php

use App\Domain\Payroll\Services\BankAdvice;
use App\Domain\Payroll\Services\MakerChecker;
use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\ActivityLogEntry;
use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;

function phPresent($employee, int $y, int $m): void
{
    foreach (PayrollPeriod::workingDates($y, $m) as $d) {
        if ($d < now()->toDateString()) {
            AttendanceDay::create(['employee_id' => $employee->id, 'date' => $d, 'status' => 'ended', 'work_seconds' => 480 * 60]);
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
            'medical' => 10000, 'conveyance' => 10000, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 100000, 'hourly_rate' => 568,
        ]);
        BankAccount::create(['employee_id' => $u->employee_id, 'bank' => 'City', 'account_name' => $u->name, 'account_no' => '1234567890', 'routing_no' => '1', 'branch' => 'Main', 'is_primary' => true]);
        phPresent($u->employee, 2026, 11);
    }
});

function phDraft($t, $by = null): PayrollRun
{
    $t->actingAs($by ?? $t->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11])->assertSessionDoesntHaveErrors();

    return PayrollRun::where('month', 11)->firstOrFail();
}

function phSubmit($t, PayrollRun $run, $by = null)
{
    return $t->actingAs($by ?? $t->hr)->post(route('payroll.runs.submit', $run), ['pay_early' => 1, 'early_reason' => 'Eid']);
}

function phItem($t, $user): PayrollItem
{
    return PayrollItem::where('employee_id', $user->employee_id)->whereHas('run', fn ($q) => $q->where('month', 11))->firstOrFail();
}

function phAdjust($t, PayrollItem $item, array $over = [], $by = null)
{
    return $t->actingAs($by ?? $t->hr)->post(route('payroll.adjustments.store', $item), ['category' => 'bonus', 'amount' => 1000, 'note' => 'Spot award', ...$over]);
}

it('blocks sending for review before the month ends unless a reason is given', function () {
    $run = phDraft($this);
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run))->assertSessionHasErrors('payroll');
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run), ['pay_early' => 1, 'early_reason' => ''])->assertSessionHasErrors('payroll');
    expect($run->refresh()->status)->toBe('draft');
    phSubmit($this, $run)->assertSessionDoesntHaveErrors();
    expect($run->refresh()->status)->toBe('review')->and($run->early_pay_reason)->toBe('Eid')
        ->and(ActivityLogEntry::where('subject_id', $run->id)->where('description', 'like', '%before the month ended (Eid)%')->exists())->toBeTrue();
});

it('lets a month that has ended go to review without a reason', function () {
    $run = phDraft($this);
    $this->travelTo(now()->setDate(2026, 12, 1)->setTime(9, 0));
    $this->actingAs($this->hr)->post(route('payroll.runs.submit', $run))->assertSessionDoesntHaveErrors();
    expect($run->refresh()->status)->toBe('review')->and($run->early_pay_reason)->toBeNull();
});

it('recomputes on submit so review sees fresh numbers', function () {
    $run = phDraft($this);
    $item = phItem($this, $this->emp);
    AttendanceDay::where('employee_id', $this->emp->employee_id)->orderBy('date')->first()->delete();
    phSubmit($this, $run);
    expect($item->refresh()->net)->toBeLessThan(100000)->and($item->absent_days)->toBeGreaterThan(0);
});

it('refuses approval when the numbers moved after review', function () {
    $run = phDraft($this);
    phSubmit($this, $run);
    PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->get()->each(fn ($i) => $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', $i)));
    AttendanceDay::where('employee_id', $this->emp->employee_id)->orderBy('date')->first()->delete();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))
        ->assertSessionHasErrors('payroll');
    expect(session('errors')->first('payroll'))->toContain('Numbers changed since review — recompute and resubmit');
    expect($run->refresh()->status)->toBe('review');
});

function phApprovable($t, PayrollRun $run): void
{
    PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->get()->each(fn ($i) => $t->actingAs($t->hr)->post(route('payroll.items.ack-variance', $i)));
}

it('records who prepared, submitted, approved and paid', function () {
    $run = phDraft($this);
    expect($run->prepared_by)->toBe($this->hr->employee_id);
    phSubmit($this, $run);
    expect($run->refresh()->submitted_by)->toBe($this->hr->employee_id)->and($run->submitted_at)->not->toBeNull();
    phApprovable($this, $run);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionDoesntHaveErrors();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-27', 'reference' => 'B1'])->assertSessionDoesntHaveErrors();
    $run->refresh();
    expect($run->approved_by)->toBe($this->mgmt->employee_id)->and($run->paid_by)->toBe($this->mgmt->employee_id)
        ->and($run->paid_on->format('Y-m-d'))->toBe('2026-11-27');
    $this->actingAs($this->mgmt)->get(route('payroll.runs.show', $run))->assertInertia(fn ($p) => $p->where('run.paid_by', $this->mgmt->employee_id)->where('run.paid_on', '2026-11-27'));
});

it('does not let the preparer or submitter approve', function () {
    $run = phDraft($this, $this->mgmt); // management prepares
    phSubmit($this, $run, $this->hr);
    phApprovable($this, $run);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasErrors('payroll');
    expect(session('errors')->first('payroll'))->toContain('You prepared this run');
    $this->actingAs($this->mgmt)->get(route('payroll.runs.show', $run))->assertInertia(fn ($p) => $p->where('approval.blocked', 'You prepared this run.'));
    expect($run->refresh()->status)->toBe('review');

    $run2 = $run->replicate()->forceFill(['prepared_by' => $this->hr->employee_id, 'submitted_by' => $this->mgmt->employee_id, 'month' => 10]);
    expect(MakerChecker::conflict($run2, $this->mgmt->employee))->toBe('You submitted this run for review.');
});

it('does not let someone who changed the run in review approve it', function () {
    $run = phDraft($this);
    phSubmit($this, $run);
    phApprovable($this, $run);
    phAdjust($this, phItem($this, $this->emp), by: $this->mgmt)->assertSessionDoesntHaveErrors();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasErrors('payroll');
    expect(session('errors')->first('payroll'))->toContain('changed this run after it was submitted');
    expect($run->refresh()->review_editors)->toContain($this->mgmt->employee_id);
});

it('allows self-approval only when the setting is on, and logs it', function () {
    $run = phDraft($this, $this->mgmt);
    phSubmit($this, $run, $this->mgmt);
    phApprovable($this, $run);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionHasErrors('payroll');
    $this->actingAs($this->mgmt)->post(route('settings.payroll.single-approver'), ['on' => true])->assertSessionDoesntHaveErrors();
    expect(MakerChecker::singleApproverAllowed())->toBeTrue();
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run))->assertSessionDoesntHaveErrors();
    expect($run->refresh()->status)->toBe('approved')->and($run->self_approved)->toBeTrue()
        ->and(ActivityLogEntry::where('subject_id', $run->id)->where('description', 'like', '%approved their own run%')->exists())->toBeTrue();
});

it('lets only approvers mark a run paid, and approvers find the payroll page', function () {
    $run = phDraft($this);
    phSubmit($this, $run);
    phApprovable($this, $run);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run));
    $this->actingAs($this->hr)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-27', 'reference' => 'B1'])->assertForbidden();
    expect($run->refresh()->status)->toBe('approved');
    $only = makeUser('employee');
    $only->givePermissionTo('approve_payroll');
    $nav = collect(\App\Support\Nav::for($only->fresh()))->flatMap(fn ($g) => $g['items'] ?? [])->pluck('id');
    expect($nav)->toContain('payroll');
});

it('requires a category and a reason, derives direction and keeps removed rows visible', function () {
    $run = phDraft($this);
    $item = phItem($this, $this->emp);
    phAdjust($this, $item, ['note' => ''])->assertSessionHasErrors('note');
    phAdjust($this, $item, ['category' => 'nonsense'])->assertSessionHasErrors('category');
    $net = $item->net;
    phAdjust($this, $item, ['category' => 'loan_recovery', 'amount' => 2000, 'note' => 'Loan #4'])->assertSessionDoesntHaveErrors();
    $adj = PayrollAdjustment::firstOrFail();
    expect($adj->kind)->toBe('deduction')->and($adj->category)->toBe('loan_recovery')->and($adj->label)->toBe('Loan recovery')
        ->and($item->refresh()->net)->toBe($net - 2000);
    $this->actingAs($this->hr)->delete(route('payroll.adjustments.destroy', $adj))->assertSessionDoesntHaveErrors();
    expect($item->refresh()->net)->toBe($net)->and(PayrollAdjustment::count())->toBe(0)
        ->and(PayrollAdjustment::withTrashed()->first()->deleted_by)->toBe($this->hr->employee_id);
    $this->actingAs($this->hr)->get(route('payroll.runs.show', $run))
        ->assertInertia(fn ($p) => $p->has('adjustments', 1)->where('adjustments.0.removed', true)->where('totals.net', fn ($n) => $n > 0));
});

it('voids a variance acknowledgement when an adjustment changes the item in review', function () {
    $run = phDraft($this);
    phSubmit($this, $run);
    $flagged = PayrollItem::where('run_id', $run->id)->where('variance_flag', true)->firstOrFail(); // new payees
    $this->actingAs($this->hr)->post(route('payroll.items.ack-variance', $flagged))->assertSessionDoesntHaveErrors();
    expect($flagged->refresh()->variance_ack_at)->not->toBeNull();
    phAdjust($this, $flagged);
    expect($flagged->refresh()->variance_ack_at)->toBeNull()->and($flagged->variance_flag)->toBeTrue();
});

it('fails recompute instead of dropping an item that has adjustments', function () {
    $run = phDraft($this);
    $item = phItem($this, $this->emp);
    phAdjust($this, $item);
    $this->emp->employee->update(['status' => 'resigned', 'exited_on' => '2026-10-15']);
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run))
        ->assertSessionHasErrors('payroll');
    expect(session('errors')->first('payroll'))->toContain('adjustments')->toContain($this->emp->name);
    expect(PayrollItem::whereKey($item->id)->exists())->toBeTrue();
});

it('blocks submit while a payable item has a negative net', function () {
    $run = phDraft($this);
    phAdjust($this, phItem($this, $this->emp), ['category' => 'manual_deduction', 'amount' => 500000, 'note' => 'Wrong entry'])->assertSessionDoesntHaveErrors();
    phSubmit($this, $run)->assertSessionHasErrors('payroll');
    expect(session('errors')->first('payroll'))->toContain('below zero')->toContain($this->emp->name);
    expect($run->refresh()->status)->toBe('draft');
    $this->actingAs($this->hr)->post(route('payroll.items.hold', phItem($this, $this->emp)), ['reason' => 'Check']);
    phSubmit($this, $run)->assertSessionDoesntHaveErrors();
    expect($run->refresh()->status)->toBe('review');
});

it('carries salary held in the last paid run as an arrears adjustment, once', function () {
    $oct = PayrollRun::create(['year' => 2026, 'month' => 10, 'kind' => 'regular', 'status' => 'paid', 'paid_at' => now()]);
    PayrollItem::create(['run_id' => $oct->id, 'employee_id' => $this->emp->employee_id, 'salary_structure_id' => $this->emp->employee->salaryStructures()->value('id'),
        'net' => 90000, 'gross' => 100000, 'hold' => true, 'hold_reason' => 'Bank details missing']);
    $run = phDraft($this);
    $item = phItem($this, $this->emp);
    $adj = PayrollAdjustment::where('item_id', $item->id)->firstOrFail();
    expect($adj->category)->toBe('arrears')->and($adj->source)->toBe('carried_hold')->and($adj->amount)->toBe(90000)
        ->and($adj->note)->toContain('Bank details missing')->and($item->net)->toBe(190000);
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run))->assertSessionDoesntHaveErrors();
    expect(PayrollAdjustment::where('item_id', $item->id)->count())->toBe(1)->and($item->refresh()->net)->toBe(190000);
});

it('exports the register with a BOM and lists who the bank advice skips', function () {
    $run = phDraft($this);
    phAdjust($this, phItem($this, $this->emp), ['category' => 'allowance', 'amount' => 700, 'note' => 'Phone']);
    $this->actingAs($this->hr)->post(route('payroll.items.hold', phItem($this, $this->hr)), ['reason' => 'Contract review']);
    $res = $this->actingAs($this->hr)->get(route('payroll.runs.register', $run))->assertOk();
    $csv = $res->getContent();
    expect($csv)->toStartWith("\xEF\xBB\xBF")->and($csv)->toContain('adj_allowance')->and($csv)->toContain('adj_loan_recovery');
    $rows = array_map(fn ($l) => str_getcsv($l, escape: ''), array_values(array_filter(explode("\n", substr($csv, 3)))));
    expect($rows)->toHaveCount(4);
    $skipped = BankAdvice::skipped($run);
    expect($skipped)->toHaveCount(1)->and($skipped[0]['reason'])->toBe('On hold: Contract review');
});

it('serves all payslips as a zip once paid', function () {
    $run = phDraft($this);
    $this->actingAs($this->hr)->get(route('payroll.runs.payslips-zip', $run))->assertNotFound();
    phSubmit($this, $run);
    phApprovable($this, $run);
    $this->actingAs($this->mgmt)->post(route('payroll.runs.approve', $run));
    $this->actingAs($this->mgmt)->post(route('payroll.runs.pay', $run), ['paid_on' => '2026-11-27', 'reference' => 'B1']);
    $res = $this->actingAs($this->hr)->get(route('payroll.runs.payslips-zip', $run))->assertOk();
    expect($res->headers->get('content-type'))->toContain('zip');
});
