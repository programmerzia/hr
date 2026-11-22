<?php

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveDays;
use App\Models\Attachment;
use App\Models\Department;
use App\Models\Holiday;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollRun;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->type = LeaveType::create(['name' => 'Casual leave', 'annual_quota' => 10, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true]);
    $this->hr = makeUser('hr', ['joined_on' => '2020-01-01']);
    $this->emp = makeUser('employee', ['joined_on' => '2020-01-01']);
    $this->regrade = Mockery::spy(RegradeDays::class);
    app()->instance(RegradeDays::class, $this->regrade);
});

function sub($t, array $over = [], ?User $as = null)
{
    return $t->actingAs($as ?? $t->emp)->post(route('leave.store'), [
        'leave_type_id' => $t->type->id, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-17',
        'half_day' => 'none', 'reason' => 'Family', ...$over,
    ]);
}

function bal($t, int $year, ?User $u = null): ?LeaveBalance
{
    return LeaveBalance::where(['employee_id' => ($u ?? $t->emp)->employee_id, 'leave_type_id' => $t->type->id, 'year' => $year])->first();
}

function seedBal($t, int $year, float $entitled)
{
    LeaveBalance::create(['employee_id' => $t->emp->employee_id, 'leave_type_id' => $t->type->id, 'year' => $year, 'entitled' => $entitled, 'used' => 0, 'pending' => 0]);
}

it('splits working days per calendar year', function () {
    expect(LeaveDays::splitByYear('2026-12-29', '2027-01-04'))->toBe([2026 => 3.0, 2027 => 2.0]);
    expect(LeaveDays::splitByYear('2026-11-16', '2026-11-17'))->toBe([2026 => 2.0]);
});

it('C3 charges a cross-year request to each year and stays symmetric', function () {
    seedBal($this, 2026, 10);
    seedBal($this, 2027, 10);
    $x = ['starts_on' => '2026-12-29', 'ends_on' => '2027-01-04'];
    sub($this, $x)->assertSessionHasNoErrors();
    $r = LeaveRequest::firstOrFail();
    expect($r->days)->toBe(5.0)->and((float) bal($this, 2026)->pending)->toBe(3.0)->and((float) bal($this, 2027)->pending)->toBe(2.0);

    $this->actingAs($this->hr)->post(route('leave.approve', $r))->assertSessionHas('success');
    expect((float) bal($this, 2026)->used)->toBe(3.0)->and((float) bal($this, 2027)->used)->toBe(2.0)
        ->and((float) bal($this, 2026)->pending)->toBe(0.0)->and((float) bal($this, 2027)->pending)->toBe(0.0);

    $this->actingAs($this->emp)->post(route('leave.cancel', $r))->assertSessionHas('success');
    expect((float) bal($this, 2026)->used)->toBe(0.0)->and((float) bal($this, 2027)->used)->toBe(0.0);
});

it('C3 keeps the submit-time split when holidays change before approval', function () {
    seedBal($this, 2026, 10);
    seedBal($this, 2027, 10);
    sub($this, ['starts_on' => '2026-12-29', 'ends_on' => '2027-01-04'])->assertSessionHasNoErrors();
    $r = LeaveRequest::firstOrFail();
    expect($r->year_split)->toEqual(['2026' => 3, '2027' => 2]);
    Holiday::create(['date' => '2027-01-03', 'name' => 'Added later']);

    $this->actingAs($this->hr)->post(route('leave.approve', $r))->assertSessionHas('success');
    expect((float) bal($this, 2026)->used)->toBe(3.0)->and((float) bal($this, 2027)->used)->toBe(2.0)
        ->and((float) bal($this, 2026)->pending)->toBe(0.0)->and((float) bal($this, 2027)->pending)->toBe(0.0);
});

it('C3 releases both years on reject and checks availability per year', function () {
    seedBal($this, 2026, 10);
    seedBal($this, 2027, 1);
    $x = ['starts_on' => '2026-12-29', 'ends_on' => '2027-01-04'];
    sub($this, $x)->assertSessionHasErrors('leave');
    expect(LeaveRequest::count())->toBe(0);
    LeaveBalance::where('year', 2027)->update(['entitled' => 5]);
    sub($this, $x)->assertSessionHasNoErrors();
    $this->actingAs($this->hr)->post(route('leave.reject', LeaveRequest::firstOrFail()), ['note' => 'No'])->assertSessionHas('success');
    expect((float) bal($this, 2026)->pending)->toBe(0.0)->and((float) bal($this, 2027)->pending)->toBe(0.0);
});

it('C4 creates a missing balance row pro-rated, contractors zero', function () {
    $j = makeUser('employee', ['joined_on' => '2026-03-20'])->employee;
    $c = makeUser('employee', ['joined_on' => '2020-01-01', 'employment_type' => 'contractor'])->employee;
    foreach ([$j, $c] as $e) {
        $r = LeaveRequest::create(['employee_id' => $e->id, 'leave_type_id' => $this->type->id, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-16', 'half_day' => 'none', 'days' => 1, 'reason' => 'x', 'status' => 'pending_hr']);
        app(BalanceService::class)->adjust($r, pending: 1);
    }
    expect((float) LeaveBalance::where('employee_id', $j->id)->value('entitled'))->toBe(7.5)
        ->and((float) LeaveBalance::where('employee_id', $c->id)->value('entitled'))->toBe(0.0);
});

it('C2 refuses dates in a payroll-locked month on submit, approve and cancel', function () {
    PayrollRun::create(['year' => 2026, 'month' => 10, 'status' => 'approved', 'kind' => 'regular']);
    sub($this, ['starts_on' => '2026-10-20', 'ends_on' => '2026-10-20'])
        ->assertSessionHasErrors(['leave' => 'Payroll for October 2026 is already approved; ask HR to adjust it there.']);
    // draft run is fine
    PayrollRun::create(['year' => 2026, 'month' => 9, 'status' => 'draft', 'kind' => 'regular']);
    sub($this, ['starts_on' => '2026-09-21', 'ends_on' => '2026-09-21'])->assertSessionHasNoErrors();
    $r = LeaveRequest::firstOrFail();
    PayrollRun::where('month', 9)->update(['status' => 'approved']);
    $this->actingAs($this->hr)->post(route('leave.approve', $r))->assertSessionHasErrors('leave');
    expect($r->fresh()->status)->not->toBe('approved');
    PayrollRun::where('month', 9)->update(['status' => 'draft']);
    $this->actingAs($this->hr)->post(route('leave.approve', $r))->assertSessionHas('success');
    PayrollRun::where('month', 9)->update(['status' => 'paid']);
    $this->travelTo(now()->setDate(2026, 9, 1));
    $this->actingAs($this->emp)->post(route('leave.cancel', $r))->assertSessionHasErrors('leave');
});

it('C1 regrades attendance on approve and on cancelling an approved request', function () {
    sub($this, ['starts_on' => '2026-11-16', 'ends_on' => '2026-11-17']);
    $r = LeaveRequest::firstOrFail();
    $this->regrade->shouldNotHaveBeenCalled();
    $this->actingAs($this->hr)->post(route('leave.approve', $r));
    $this->regrade->shouldHaveReceived('__invoke')->with($this->emp->employee_id, '2026-11-16', '2026-11-17')->once();
    $this->actingAs($this->emp)->post(route('leave.cancel', $r));
    $this->regrade->shouldHaveReceived('__invoke')->with($this->emp->employee_id, '2026-11-16', '2026-11-17')->twice();
});

it('C1 does not regrade when cancelling a pending request', function () {
    sub($this);
    $this->actingAs($this->emp)->post(route('leave.cancel', LeaveRequest::firstOrFail()));
    $this->regrade->shouldNotHaveReceived('__invoke');
});

it('C5 re-prorates untouched balances on quota change, leaves hand-edited ones', function () {
    $a = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    $b = makeUser('employee', ['joined_on' => '2026-03-20'])->employee;
    $c = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    LeaveBalance::create(['employee_id' => $a->id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 10]);
    LeaveBalance::create(['employee_id' => $b->id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 7.5]);
    LeaveBalance::create(['employee_id' => $c->id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 12]);
    LeaveBalance::create(['employee_id' => $a->id, 'leave_type_id' => $this->type->id, 'year' => 2025, 'entitled' => 10]);
    $this->actingAs($this->hr)->patch(route('leave.types.update', $this->type), ['annual_quota' => 12])->assertSessionHas('success');
    $e = fn ($emp, $y = 2026) => (float) LeaveBalance::where(['employee_id' => $emp->id, 'year' => $y])->value('entitled');
    expect($e($a))->toBe(12.0)->and($e($b))->toBe(9.0)->and($e($c))->toBe(12.0)->and($e($a, 2025))->toBe(10.0);
});

it('C5 also re-prorates through the settings leave-type update', function () {
    $mgr = makeUser('management');
    $a = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    LeaveBalance::create(['employee_id' => $a->id, 'leave_type_id' => $this->type->id, 'year' => 2026, 'entitled' => 10]);
    $this->actingAs($mgr)->put(route('settings.leave-types.update', $this->type), [
        'name' => 'Casual leave', 'annual_quota' => 9, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true,
        'carry_forward_cap' => null, 'allowed_on_probation' => true, 'encashable' => false,
    ])->assertSessionHas('success');
    expect((float) LeaveBalance::where('employee_id', $a->id)->value('entitled'))->toBe(9.0);
});

it('C6 notifies management when the only HR user is the requester', function () {
    $boss = makeUser('management');
    seedBalFor($this, $this->hr);
    sub($this, [], $this->hr)->assertSessionHasNoErrors();
    expect($boss->notifications()->count())->toBe(1)->and($this->hr->notifications()->count())->toBe(0);
});

function seedBalFor($t, User $u)
{
    LeaveBalance::create(['employee_id' => $u->employee_id, 'leave_type_id' => $t->type->id, 'year' => 2026, 'entitled' => 10]);
}

it('C6 notifies other HR users and not the requester', function () {
    $hr2 = makeUser('hr');
    seedBalFor($this, $this->hr);
    sub($this, [], $this->hr);
    expect($hr2->notifications()->count())->toBe(1)->and($this->hr->notifications()->count())->toBe(0);
});

it('C7 records a single hr approval when HR steps in for the lead, with no self notification', function () {
    $lead = makeUser('team_lead');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $lead->employee_id]);
    $this->emp->employee->update(['team_id' => $team->id]);
    seedBal($this, 2026, 10);
    sub($this);
    $r = LeaveRequest::firstOrFail();
    expect($r->status)->toBe('pending_lead');
    $before = $this->hr->notifications()->count();
    $this->actingAs($this->hr)->post(route('leave.approve', $r), ['note' => 'fine'])->assertSessionHas('success');
    expect($r->fresh()->status)->toBe('approved');
    $rows = LeaveApproval::where('leave_request_id', $r->id)->get();
    expect($rows)->toHaveCount(1)->and($rows[0]->stage)->toBe('hr')->and($rows[0]->note)->toContain('on behalf of lead')
        ->and($this->hr->notifications()->count())->toBe($before);
});

it('C8 stores an optional attachment privately and serves it to requester, HR and lead only', function () {
    Storage::fake('local');
    $lead = makeUser('team_lead');
    $team = Team::create(['name' => 'Web', 'department_id' => Department::create(['name' => 'Eng'])->id, 'lead_employee_id' => $lead->employee_id]);
    $this->emp->employee->update(['team_id' => $team->id]);
    seedBal($this, 2026, 10);
    $file = UploadedFile::fake()->create('note.pdf', 100, 'application/pdf');
    sub($this, ['attachment' => $file])->assertSessionHasNoErrors();
    $r = LeaveRequest::firstOrFail();
    $att = Attachment::where('attachable_id', $r->id)->firstOrFail();
    expect($att->name)->toBe('note.pdf')->and($att->attachable_type)->toBe('leave_request');
    Storage::disk('local')->assertExists($att->path);
    $this->actingAs($this->emp)->get(route('leave.attachment', $r))->assertOk();
    $this->actingAs($this->hr)->get(route('leave.attachment', $r))->assertOk();
    $this->actingAs($lead)->get(route('leave.attachment', $r))->assertOk();
    $this->actingAs(makeUser('employee'))->get(route('leave.attachment', $r))->assertForbidden();
    $this->actingAs(makeUser('team_lead'))->get(route('leave.attachment', $r))->assertForbidden();
});

it('C8 rejects wrong type and oversize files', function () {
    Storage::fake('local');
    seedBal($this, 2026, 10);
    sub($this, ['attachment' => UploadedFile::fake()->create('x.exe', 10, 'application/x-msdownload')])->assertSessionHasErrors('attachment');
    sub($this, ['attachment' => UploadedFile::fake()->create('big.pdf', 6000, 'application/pdf')])->assertSessionHasErrors('attachment');
    expect(LeaveRequest::count())->toBe(0);
});

it('C8 submit without attachment still works', function () {
    seedBal($this, 2026, 10);
    sub($this)->assertSessionHasNoErrors();
    expect(Attachment::count())->toBe(0);
});
