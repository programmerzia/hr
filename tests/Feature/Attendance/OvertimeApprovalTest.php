<?php

use App\Models\AttendanceDay;
use App\Models\BankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\RegularizationRequest;
use App\Models\SalaryStructure;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    PayrollPolicy::forDate('2026-11-30')->update(['overtime_enabled' => true, 'overtime_requires_approval' => true]);
    $this->lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $this->lead->employee_id]);
    $this->lead->employee->update(['team_id' => $team->id]);
    $this->member = makeUser('employee', ['team_id' => $team->id]);
    $this->otherLead = makeUser('team_lead');
    Team::factory()->create(['lead_employee_id' => $this->otherLead->employee_id]);
    $this->hr = makeUser('hr');
    // Tuesday 10 Nov: 10 working hours = 120 minutes beyond the 480 standard.
    $this->day = AttendanceDay::create([
        'employee_id' => $this->member->employee_id, 'date' => '2026-11-10', 'status' => 'ended',
        'first_in_at' => '2026-11-10 10:00:00', 'last_out_at' => '2026-11-10 20:00:00', 'work_seconds' => 600 * 60,
    ]);
});

it('lets the lead approve overtime within the raw minutes and writes an audit row', function () {
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 90])->assertSessionHasNoErrors();
    expect($this->day->refresh()->approved_overtime_minutes)->toBe(90);
    $audit = RegularizationRequest::where('attendance_day_id', $this->day->id)->firstOrFail();
    expect($audit->kind)->toBe('overtime')->and($audit->status)->toBe('approved')->and($audit->decided_by)->toBe($this->lead->employee_id);
    // The audit row must not count as a regularization of the day.
    expect($this->day->is_regularized)->toBeFalse();
});

it('rejects minutes above the overtime worked', function () {
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 121])->assertSessionHasErrors('minutes');
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 0])->assertSessionHasErrors('minutes');
    expect($this->day->refresh()->approved_overtime_minutes)->toBe(0)->and(RegularizationRequest::count())->toBe(0);
});

it('denies leads outside the team, plain employees and self-approval; HR may approve anyone', function () {
    $this->actingAs($this->otherLead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 30])->assertForbidden();
    $this->actingAs($this->member)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 30])->assertForbidden();
    $own = AttendanceDay::create(['employee_id' => $this->lead->employee_id, 'date' => '2026-11-10', 'status' => 'ended', 'work_seconds' => 600 * 60]);
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $own), ['minutes' => 30])->assertForbidden();
    $this->actingAs($this->hr)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 30])->assertSessionHasNoErrors();
    expect($this->day->refresh()->approved_overtime_minutes)->toBe(30);
});

it('refuses approval when the policy does not require it', function () {
    PayrollPolicy::forDate('2026-11-30')->update(['overtime_requires_approval' => false]);
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 30])->assertSessionHasErrors('minutes');
    PayrollPolicy::forDate('2026-11-30')->update(['overtime_requires_approval' => true, 'overtime_enabled' => false]);
    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 30])->assertSessionHasErrors('minutes');
});

it('revokes an approval back to zero', function () {
    $this->day->update(['approved_overtime_minutes' => 60]);
    $this->actingAs($this->lead)->post(route('attendance.overtime.revoke', $this->day))->assertSessionHasNoErrors();
    expect($this->day->refresh()->approved_overtime_minutes)->toBe(0);
    $this->actingAs($this->otherLead)->post(route('attendance.overtime.revoke', $this->day))->assertForbidden();
});

it('shows the overtime column data only when approval is on', function () {
    $this->actingAs($this->lead)->get(route('attendance.team.history', ['from' => '2026-11-09', 'to' => '2026-11-12']))->assertInertia(fn (Assert $p) => $p
        ->where('overtime.approval', true)->where('rows.0.overtime.raw', 120)->where('rows.0.overtime.approved', 0));
    PayrollPolicy::forDate('2026-11-30')->update(['overtime_enabled' => false]);
    $this->actingAs($this->lead)->get(route('attendance.team.history', ['from' => '2026-11-09', 'to' => '2026-11-12']))->assertInertia(fn (Assert $p) => $p
        ->where('overtime.approval', false)->where('rows.0.overtime', null));
});

it('pays only approved overtime in the payroll run', function () {
    SalaryStructure::create([
        'employee_id' => $this->member->employee_id, 'effective_from' => '2024-01-01', 'basic' => 55000, 'house_rent' => 25000,
        'medical' => 10000, 'conveyance' => 10000, 'pf_percent' => 0, 'tax_monthly' => 0, 'gross' => 100000, 'hourly_rate' => 600,
    ]);
    BankAccount::create(['employee_id' => $this->member->employee_id, 'bank' => 'City', 'account_name' => 'X', 'account_no' => '1234567890', 'routing_no' => '1', 'branch' => 'Main', 'is_primary' => true]);
    $item = fn () => PayrollItem::where('employee_id', $this->member->employee_id)->firstOrFail();

    $this->actingAs($this->hr)->post(route('payroll.runs.store'), ['year' => 2026, 'month' => 11]);
    expect($item()->overtime_minutes)->toBe(0)->and($item()->overtime_pay)->toBe(0);

    $this->actingAs($this->lead)->post(route('attendance.overtime.approve', $this->day), ['minutes' => 100]);
    $run = PayrollRun::firstOrFail();
    $this->actingAs($this->hr)->post(route('payroll.runs.recompute', $run));
    // 100 minutes floors to 90 (30-minute blocks): 1.5 h x 600 x 1.5 = 1350.
    expect($item()->overtime_minutes)->toBe(90)->and($item()->overtime_pay)->toBe(1350);
});
