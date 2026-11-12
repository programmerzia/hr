<?php

use App\Domain\Settings\PolicyPreview;
use App\Models\ActivityLogEntry;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
});

function attForm(array $over = []): array
{
    return [
        'shift_start' => '09:00', 'shift_end' => '18:00', 'grace_minutes' => 10, 'standard_minutes' => 480,
        'idle_timeout_minutes' => 10, 'lunch_cap_minutes' => 60, 'weekend_days' => [5, 6],
        'half_day_after_minutes' => 120, 'early_leave_grace_minutes' => 30, 'early_counts_as_late' => true,
        'half_day_min_minutes' => 240, 'absent_below_minutes' => 60, 'effective_from' => '2026-12-01', ...$over,
    ];
}

function payForm(array $over = []): array
{
    return [...collect(PayrollPolicy::DEFAULTS)->except('effective_from')->all(), 'effective_from' => '2026-12-01', ...$over];
}

it('renders every settings page for hr and denies others', function () {
    $pages = [
        'settings' => 'Settings/SettingsPage', 'settings.attendance.index' => 'Settings/AttendancePolicyPage',
        'settings.payroll.index' => 'Settings/PayrollPolicyPage', 'settings.leave-types.index' => 'Settings/LeaveTypesPage',
        'settings.holidays.index' => 'Settings/HolidaysPage',
    ];
    foreach ($pages as $route => $component) {
        $this->actingAs($this->hr)->get(route($route))->assertInertia(fn (Assert $p) => $p->component($component, false));
        $this->actingAs(makeUser('management'))->get(route($route))->assertOk();
        $this->actingAs(makeUser('employee'))->get(route($route))->assertForbidden();
        $this->actingAs(makeUser('team_lead'))->get(route($route))->assertForbidden();
    }
});

it('creates an attendance version that becomes current from its date', function () {
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm())->assertSessionDoesntHaveErrors()->assertSessionHas('success');
    expect(AttendancePolicy::forDate('2026-11-30')->shift_start)->toBe('10:00')
        ->and(AttendancePolicy::forDate('2026-12-01')->shift_start)->toBe('09:00');
    expect(ActivityLogEntry::where('subject_type', 'settings')->count())->toBe(1);
    $this->actingAs($this->hr)->get(route('settings.attendance.index'))
        ->assertInertia(fn (Assert $p) => $p->has('versions', 2)->where('versions.0.editable', true)->where('versions.1.is_current', true)->has('history', 1));
    $this->travelTo(now()->setDate(2026, 12, 1));
    expect(AttendancePolicy::forDate(now()->toDateString())->shift_start)->toBe('09:00');
});

it('rejects a duplicate version date', function () {
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm());
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm())->assertSessionHasErrors('effective_from');
    $this->actingAs($this->hr)->post(route('settings.payroll.store'), payForm());
    $this->actingAs($this->hr)->post(route('settings.payroll.store'), payForm())->assertSessionHasErrors('effective_from');
});

it('validates attendance bounds and past dates', function () {
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm(['effective_from' => '2026-11-01']))->assertSessionHasErrors('effective_from');
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm(['shift_end' => '08:00']))->assertSessionHasErrors('shift_end');
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm(['absent_below_minutes' => 300]))->assertSessionHasErrors('absent_below_minutes');
    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm(['weekend_days' => [9]]))->assertSessionHasErrors('weekend_days.0');
});

it('keeps started versions immutable and edits only upcoming ones', function () {
    $past = AttendancePolicy::current();
    $this->actingAs($this->hr)->put(route('settings.attendance.update', $past), attForm())->assertSessionHas('error');
    expect($past->fresh()->shift_start)->toBe('10:00');
    $this->actingAs($this->hr)->delete(route('settings.attendance.destroy', $past))->assertSessionHas('error');

    $this->actingAs($this->hr)->post(route('settings.attendance.store'), attForm());
    $next = AttendancePolicy::whereDate('effective_from', '2026-12-01')->firstOrFail();
    $this->actingAs($this->hr)->put(route('settings.attendance.update', $next), attForm(['grace_minutes' => 20]))->assertSessionHas('success');
    expect($next->fresh()->grace_minutes)->toBe(20);
    $this->actingAs($this->hr)->delete(route('settings.attendance.destroy', $next))->assertSessionHas('success');
    expect(AttendancePolicy::count())->toBe(1);
});

it('creates payroll versions with switches and protects the current one', function () {
    $cur = PayrollPolicy::current();
    expect($cur->pf_enabled)->toBeFalse();
    $this->actingAs($this->hr)->post(route('settings.payroll.store'), payForm(['pf_enabled' => true, 'pf_employee_percent' => 5, 'pf_employer_percent' => 5]))->assertSessionDoesntHaveErrors();
    expect(PayrollPolicy::forDate('2026-11-30')->pf_enabled)->toBeFalse()
        ->and(PayrollPolicy::forDate('2026-12-01')->pf_enabled)->toBeTrue();
    $this->actingAs($this->hr)->put(route('settings.payroll.update', $cur), payForm(['effective_from' => '2026-12-20']))->assertSessionHas('error');
    $this->actingAs($this->hr)->post(route('settings.payroll.store'), payForm(['daily_rate_basis' => 'weekly']))->assertSessionHasErrors('daily_rate_basis');
    $this->actingAs($this->hr)->post(route('settings.payroll.store'), payForm(['pf_employee_percent' => 90, 'effective_from' => '2026-12-05']))->assertSessionHasErrors('pf_employee_percent');
});

it('computes the policy preview for working days and fixed 30', function () {
    // November 2026: 30 days, Fri/Sat weekends -> 22 working days.
    $wd = PolicyPreview::compute([...PayrollPolicy::DEFAULTS, 'late_penalty_enabled' => true], 50000, '2026-11-01', AttendancePolicy::current());
    expect($wd['divisor'])->toBe(22)->and($wd['daily_rate'])->toBe(2272.73)->and($wd['absence'])->toBe(2273)
        ->and($wd['half_day'])->toBe(1136)->and($wd['lates'])->toBe(1136);
    $f = PolicyPreview::compute([...PayrollPolicy::DEFAULTS, 'daily_rate_basis' => 'fixed_30'], 50000, '2026-11-01');
    expect($f['divisor'])->toBe(30)->and($f['absence'])->toBe(1667)->and($f['lates'])->toBe(0);
    $off = PolicyPreview::compute([...PayrollPolicy::DEFAULTS, 'lop_enabled' => false], 50000, '2026-11-01');
    expect($off['absence'])->toBe(0);
});

it('serves the preview from query parameters', function () {
    $this->actingAs($this->hr)->get(route('settings.payroll.index', ['p' => ['daily_rate_basis' => 'fixed_30', 'lop_enabled' => '1', 'effective_from' => '2026-12-01']]))
        ->assertInertia(fn (Assert $p) => $p->where('preview.divisor', 30)->where('preview.absence', 1667));
});

it('blocks deleting a leave type that is referenced', function () {
    $this->actingAs($this->hr)->post(route('settings.leave-types.store'), [
        'name' => 'Study leave', 'annual_quota' => 5, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true,
        'carry_forward_cap' => null, 'allowed_on_probation' => false, 'encashable' => true,
    ])->assertSessionHas('success');
    $free = LeaveType::where('name', 'Study leave')->firstOrFail();
    $used = LeaveType::create(['name' => 'Casual', 'annual_quota' => 2, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => false]);
    $emp = makeUser('employee');
    LeaveRequest::create(['employee_id' => $emp->employee_id, 'leave_type_id' => $used->id, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-16', 'days' => 1, 'reason' => 'x', 'status' => 'approved']);
    $this->actingAs($this->hr)->delete(route('settings.leave-types.destroy', $used))->assertSessionHas('error');
    expect(LeaveType::find($used->id))->not->toBeNull();
    $this->actingAs($this->hr)->delete(route('settings.leave-types.destroy', $free))->assertSessionHas('success');
    $this->actingAs($this->hr)->put(route('settings.leave-types.update', $used), [
        'name' => 'Casual', 'annual_quota' => 3, 'is_paid' => true, 'carry_forward' => true, 'allows_half_day' => true,
        'carry_forward_cap' => 7, 'allowed_on_probation' => true, 'encashable' => false,
    ])->assertSessionDoesntHaveErrors();
    expect((float) $used->fresh()->annual_quota)->toBe(3.0)->and((float) $used->fresh()->carry_forward_cap)->toBe(7.0);
    expect($free->fresh())->toBeNull();
});

it('manages holidays and blocks removal in a paid month', function () {
    $this->actingAs($this->hr)->post(route('settings.holidays.store'), ['date' => '2026-12-16', 'name' => 'Victory Day'])->assertSessionHas('success');
    $this->actingAs($this->hr)->post(route('settings.holidays.store'), ['date' => '2026-12-16', 'name' => 'Dup'])->assertSessionHasErrors('date');
    $this->actingAs($this->hr)->post(route('settings.holidays.bulk'), ['lines' => "2026-12-25  Christmas\n2026-12-16 Dup\nbad line\n2026-02-30 Nope"])->assertSessionHas('success');
    expect(Holiday::count())->toBe(2);

    $oct = Holiday::create(['date' => '2026-10-20', 'name' => 'Durga Puja']);
    PayrollRun::create(['year' => 2026, 'month' => 10, 'status' => 'paid']);
    $this->actingAs($this->hr)->delete(route('settings.holidays.destroy', $oct))->assertSessionHas('error');
    expect(Holiday::find($oct->id))->not->toBeNull();
    $dec = Holiday::whereDate('date', '2026-12-16')->firstOrFail();
    $this->actingAs($this->hr)->delete(route('settings.holidays.destroy', $dec))->assertSessionHas('success');
    $this->actingAs($this->hr)->get(route('settings.holidays.index', ['year' => 2026]))
        ->assertInertia(fn (Assert $p) => $p->has('holidays', 2)->where('holidays.0.locked', true));
});
