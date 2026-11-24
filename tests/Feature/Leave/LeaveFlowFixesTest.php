<?php

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Leave\Actions\EndEarly;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\AttendanceDay;
use App\Models\Department;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // Wednesday 2026-11-18: weekend is Fri/Sat, so Sun 22 .. Thu 26 are working days.
    $this->travelTo(now()->setDate(2026, 11, 18)->setTime(10, 0));
    $this->type = LeaveType::create(['name' => 'Casual leave', 'annual_quota' => 10, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true]);
    $this->lead = makeUser('team_lead');
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->emp = makeUser('employee');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $this->lead->employee_id]);
    $this->emp->employee->update(['team_id' => $team->id]);
    LeaveBalance::create(['employee_id' => $this->emp->employee_id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 10, 'used' => 0, 'pending' => 0]);
});

function fxSubmit($t, $user = null, array $over = [])
{
    return $t->actingAs($user ?? $t->emp)->post(route('leave.store'), [
        'leave_type_id' => $t->type->id, 'starts_on' => '2026-11-22', 'ends_on' => '2026-11-24',
        'half_day' => 'none', 'reason' => 'Trip', ...$over,
    ]);
}

function fxApproved($t, string $start, string $end, float $days): LeaveRequest
{
    $r = LeaveRequest::create([
        'employee_id' => $t->emp->employee_id, 'leave_type_id' => $t->type->id, 'starts_on' => $start, 'ends_on' => $end,
        'half_day' => 'none', 'days' => $days, 'reason' => 'Trip', 'status' => 'approved',
    ]);
    LeaveBalance::where('employee_id', $t->emp->employee_id)->update(['used' => $days]);

    return $r;
}

it('notifies the lead and the HR deciders at submit, never the requester', function () {
    fxSubmit($this)->assertSessionHas('success');
    expect($this->lead->notifications()->count())->toBe(1)
        ->and($this->hr->notifications()->count())->toBe(1)
        ->and($this->mgmt->notifications()->count())->toBe(1)
        ->and($this->emp->notifications()->count())->toBe(0);
    expect($this->hr->notifications()->first()->data['body'] ?? json_encode($this->hr->notifications()->first()->data))->toContain("Waiting for {$this->lead->name}");
});

it('notifies by approve_leave_hr permission, not role', function () {
    $helper = makeUser('employee');
    $helper->givePermissionTo('approve_leave_hr');
    fxSubmit($this);
    expect($helper->notifications()->count())->toBe(1);
    $this->actingAs($helper)->get(route('leave.approvals'))
        ->assertInertia(fn (Assert $p) => $p->component('Leave/ApprovalsPage', false)->has('items', 1)->where('scope', 'hr'));
    $this->actingAs($helper)->post(route('leave.approve', LeaveRequest::firstOrFail()))->assertSessionHas('success');
    expect(LeaveRequest::firstOrFail()->status)->toBe('approved');
});

it('goes straight to HR when the lead has no account or is inactive', function () {
    $this->lead->employee->update(['status' => 'terminated']);
    fxSubmit($this);
    expect(LeaveRequest::firstOrFail()->status)->toBe('pending_hr')
        ->and($this->lead->notifications()->count())->toBe(0)
        ->and($this->hr->notifications()->count())->toBe(1);
});

it('sends HR own request to the other HR-permission holders, falling back to management', function () {
    $this->hr->employee->update(['team_id' => null]);
    fxSubmit($this, $this->hr);
    expect($this->hr->notifications()->count())->toBe(0)->and($this->mgmt->notifications()->count())->toBe(1);
    expect(LeaveRequest::firstOrFail()->status)->toBe('pending_hr');
});

it('falls back to manage_access holders when nobody holds approve_leave_hr', function () {
    $this->hr->revokePermissionTo('approve_leave_hr');
    $this->hr->syncRoles([]);
    $this->mgmt->revokePermissionTo('approve_leave_hr');
    $this->mgmt->syncRoles([]);
    $this->mgmt->givePermissionTo('manage_access');
    fxSubmit($this);
    expect($this->mgmt->notifications()->count())->toBe(1)->and($this->hr->notifications()->count())->toBe(0);
});

it('does not start work on login while on approved full-day leave', function () {
    fxApproved($this, '2026-11-18', '2026-11-19', 2);
    $this->post(route('login.store'), ['email' => $this->emp->email, 'password' => 'password'])->assertRedirect(route('attendance.my-day'));
    expect(AttendanceDay::where('employee_id', $this->emp->employee_id)->whereNotNull('first_in_at')->count())->toBe(0);
    $this->assertAuthenticated();
});

it('resume asks to confirm, then shortens the leave, refunds and starts work', function () {
    $r = fxApproved($this, '2026-11-16', '2026-11-19', 3); // Mon 16, Tue 17, Wed 18 (Thu 19 too): 4 days
    $r->update(['days' => 4]);
    LeaveBalance::query()->update(['used' => 4]);
    $this->actingAs($this->emp)->post(route('attendance.resume'))->assertSessionHasErrors('needs_leave_confirm');
    expect($r->fresh()->ends_on->toDateString())->toBe('2026-11-19');

    $this->actingAs($this->emp)->post(route('attendance.resume'), ['confirm_leave' => true])->assertSessionDoesntHaveErrors();
    $r->refresh();
    expect($r->status)->toBe('approved')->and($r->ends_on->toDateString())->toBe('2026-11-17')->and($r->days)->toBe(2.0);
    expect((float) LeaveBalance::firstOrFail()->used)->toBe(2.0);
    $day = AttendanceDay::where('employee_id', $this->emp->employee_id)->whereDate('date', '2026-11-18')->firstOrFail();
    expect($day->first_in_at)->not->toBeNull()->and((int) $day->late_minutes)->toBe(0);
});

it('does not ask for confirmation on a half day leave', function () {
    LeaveRequest::create([
        'employee_id' => $this->emp->employee_id, 'leave_type_id' => $this->type->id, 'starts_on' => '2026-11-18', 'ends_on' => '2026-11-18',
        'half_day' => 'second_half', 'days' => 0.5, 'reason' => 'x', 'status' => 'approved',
    ]);
    $this->actingAs($this->emp)->post(route('attendance.resume'))->assertSessionDoesntHaveErrors();
});

it('ends a leave early mid-way and notifies lead and HR', function () {
    $r = fxApproved($this, '2026-11-15', '2026-11-19', 4); // Sun 15..Thu 19, working Sun-Thu = 5 -> use 4 stored; recompute below
    $r->update(['days' => 5]);
    LeaveBalance::query()->update(['used' => 5]);
    $this->actingAs($this->emp)->post(route('leave.end-early', $r))->assertSessionHas('success');
    $r->refresh();
    expect($r->status)->toBe('approved')->and($r->ends_on->toDateString())->toBe('2026-11-17')->and($r->days)->toBe(3.0);
    expect((float) LeaveBalance::firstOrFail()->used)->toBe(3.0);
    expect($this->lead->notifications()->count())->toBe(1)->and($this->hr->notifications()->count())->toBe(1)->and($this->emp->notifications()->count())->toBe(0);
});

it('cancels the whole leave when ending it on the first day', function () {
    $r = fxApproved($this, '2026-11-18', '2026-11-19', 2);
    (new (EndEarly::class)(...[app(BalanceService::class), app(RegradeDays::class), app(LeaveNotifier::class)]))($r, '2026-11-18');
    expect($r->fresh()->status)->toBe('cancelled')->and((float) LeaveBalance::firstOrFail()->used)->toBe(0.0);
});

it('only the requester may end a leave early', function () {
    $r = fxApproved($this, '2026-11-16', '2026-11-19', 4);
    $this->actingAs($this->hr)->post(route('leave.end-early', $r))->assertForbidden();
});

it('my day says the person is on leave today, and not after the leave ended', function () {
    fxApproved($this, '2026-11-17', '2026-11-18', 2);
    $this->actingAs($this->emp)->get(route('attendance.my-day'))
        ->assertInertia(fn (Assert $p) => $p->where('leave_today.starts_on', '2026-11-17')->where('leave_today.ends_on', '2026-11-18'));
    $this->travelTo(now()->setDate(2026, 11, 19)->setTime(10, 0));
    $this->actingAs($this->emp)->get(route('attendance.my-day'))->assertInertia(fn (Assert $p) => $p->where('leave_today', null));
});
