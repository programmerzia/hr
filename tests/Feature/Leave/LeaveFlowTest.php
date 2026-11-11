<?php

use App\Models\Department;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->type = LeaveType::create(['name' => 'Casual leave', 'annual_quota' => 2, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true]);
    $this->lead = makeUser('team_lead');
    $this->hr = makeUser('hr');
    $this->emp = makeUser('employee');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $this->lead->employee_id]);
    $this->emp->employee->update(['team_id' => $team->id]);
    $this->lead->employee->update(['team_id' => $team->id]);
    LeaveBalance::create([
        'employee_id' => $this->emp->employee_id, 'leave_type_id' => $this->type->id, 'year' => 2026,
        'entitled' => 2, 'used' => 0, 'pending' => 0,
    ]);
});

function leaveSubmit($t, array $over = [])
{
    return $t->actingAs($t->emp)->post(route('leave.store'), [
        'leave_type_id' => $t->type->id, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-17',
        'half_day' => 'none', 'reason' => 'Family event', ...$over,
    ]);
}

function leaveBal($t): LeaveBalance
{
    return LeaveBalance::where('employee_id', $t->emp->employee_id)->firstOrFail();
}

it('renders my leave', function () {
    $this->actingAs($this->emp)->get(route('leave.mine'))
        ->assertInertia(fn (Assert $p) => $p->component('Leave/MyLeavePage', false)
            ->has('balances')->has('requests')->has('leave_types')->has('holidays')->has('policy'));
});

it('submits to the lead and reserves pending days', function () {
    leaveSubmit($this)->assertSessionHas('success')->assertSessionDoesntHaveErrors();
    $r = LeaveRequest::firstOrFail();
    expect($r->status)->toBe('pending_lead')->and($r->days)->toBe(2.0)->and((float) leaveBal($this)->pending)->toBe(2.0);
    expect($this->lead->notifications()->count())->toBe(1)
        ->and($this->lead->notifications()->first()->data['kind'])->toBe('leave');
});

it('fails with insufficient balance using the mock message', function () {
    leaveSubmit($this, ['starts_on' => '2026-11-15', 'ends_on' => '2026-11-19'])
        ->assertSessionHasErrors(['leave' => 'Only 2 days of casual leave available']);
    expect(LeaveRequest::count())->toBe(0);
});

it('rejects overlapping and weekend only ranges', function () {
    leaveSubmit($this);
    leaveSubmit($this, ['starts_on' => '2026-11-17', 'ends_on' => '2026-11-17'])
        ->assertSessionHasErrors(['leave' => 'You already have leave on some of these dates']);
    leaveSubmit($this, ['starts_on' => '2026-11-20', 'ends_on' => '2026-11-21'])
        ->assertSessionHasErrors(['leave' => 'The selected dates are all weekends or holidays']);
});

it('moves from lead approval to HR approval and updates the balance', function () {
    leaveSubmit($this);
    $r = LeaveRequest::firstOrFail();

    $this->actingAs($this->lead)->post(route('leave.approve', $r))->assertSessionHas('success');
    expect($r->fresh()->status)->toBe('pending_hr')->and($this->hr->notifications()->count())->toBe(1);

    $this->actingAs($this->hr)->post(route('leave.approve', $r))->assertSessionHas('success');
    expect($r->fresh()->status)->toBe('approved')
        ->and((float) leaveBal($this)->used)->toBe(2.0)->and((float) leaveBal($this)->pending)->toBe(0.0)
        ->and($this->emp->notifications()->first()->data['title'])->toBe('Leave approved');
});

it('shows the lead their team queue with the badge count', function () {
    leaveSubmit($this);
    $this->actingAs($this->lead)->get(route('leave.approvals'))
        ->assertInertia(fn (Assert $p) => $p->component('Leave/ApprovalsPage', false)->has('items', 1)
            ->where('items.0.balance_after', 0)->where('badges.leave-approvals', 1));
});

it('forbids an employee from approving or opening approvals', function () {
    leaveSubmit($this);
    $r = LeaveRequest::firstOrFail();
    $this->actingAs($this->emp)->post(route('leave.approve', $r))->assertForbidden();
    $this->actingAs($this->emp)->post(route('leave.reject', $r), ['note' => 'no'])->assertForbidden();
    $this->actingAs($this->emp)->get(route('leave.approvals'))->assertForbidden();
});

it('forbids a lead from another team', function () {
    leaveSubmit($this);
    $other = makeUser('team_lead');
    Team::create(['name' => 'Other', 'department_id' => Department::first()->id, 'lead_employee_id' => $other->employee_id]);
    $this->actingAs($other)->post(route('leave.approve', LeaveRequest::firstOrFail()))->assertForbidden();
});

it('rejects with a note, releasing the pending days', function () {
    leaveSubmit($this);
    $r = LeaveRequest::firstOrFail();
    $this->actingAs($this->lead)->post(route('leave.reject', $r), ['note' => ' '])
        ->assertSessionHasErrors(['leave' => 'Add a reason for rejecting']);
    $this->actingAs($this->lead)->post(route('leave.reject', $r), ['note' => 'Release freeze'])->assertSessionHas('success');
    expect($r->fresh()->status)->toBe('rejected')->and((float) leaveBal($this)->pending)->toBe(0.0)
        ->and(LeaveApproval::first()->note)->toBe('Release freeze');
});

it('cancels a pending request and returns the days', function () {
    leaveSubmit($this);
    $r = LeaveRequest::firstOrFail();
    $this->actingAs($this->emp)->post(route('leave.cancel', $r))->assertSessionHas('success');
    expect($r->fresh()->status)->toBe('cancelled')->and((float) leaveBal($this)->pending)->toBe(0.0);
    $this->actingAs($this->emp)->post(route('leave.cancel', $r))
        ->assertSessionHasErrors(['leave' => 'This request can no longer be cancelled']);
});

it('only the owner can cancel', function () {
    leaveSubmit($this);
    $this->actingAs($this->hr)->post(route('leave.cancel', LeaveRequest::firstOrFail()))->assertForbidden();
});

it('lets HR update leave types but not employees', function () {
    $this->actingAs($this->hr)->patch(route('leave.types.update', $this->type), ['annual_quota' => 5])->assertSessionHas('success');
    expect((float) $this->type->fresh()->annual_quota)->toBe(5.0);
    $this->actingAs($this->emp)->patch(route('leave.types.update', $this->type), ['annual_quota' => 9])->assertForbidden();
    $this->actingAs($this->hr)->get(route('leave.policy'))->assertInertia(fn (Assert $p) => $p->component('Leave/PolicyPage', false));
});

it('renders the calendar in viewer scope', function () {
    leaveSubmit($this);
    $r = LeaveRequest::firstOrFail();
    $r->update(['status' => 'approved']);
    $this->actingAs($this->lead)->get(route('leave.calendar', ['month' => '2026-11']))
        ->assertInertia(fn (Assert $p) => $p->component('Leave/CalendarPage', false)->has('events', 1)->where('month', '2026-11'));
    $this->actingAs($this->emp)->get(route('leave.calendar'))->assertForbidden();
});
