<?php

use App\Domain\Leave\Actions\ProvisionBalances;
use App\Domain\Leave\Actions\RolloverYear;
use App\Domain\Leave\Services\Encashment;
use App\Domain\Leave\Services\Entitlement;
use App\Models\ActivityLogEntry;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use Carbon\Carbon;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->annual = LeaveType::create(['name' => 'Annual leave', 'annual_quota' => 14, 'is_paid' => true, 'carry_forward' => true, 'carry_forward_cap' => 7, 'allowed_on_probation' => false, 'encashable' => true, 'allows_half_day' => true]);
    $this->casual = LeaveType::create(['name' => 'Casual leave', 'annual_quota' => 8, 'is_paid' => true, 'carry_forward' => false, 'allows_half_day' => true]);
});

it('prorates entitlement by joining date', function (string $joined, float $expected) {
    expect(Entitlement::prorated($this->annual, Carbon::parse($joined), 2026))->toBe($expected);
})->with([
    'jan 1' => ['2026-01-01', 14.0],
    'mar 10' => ['2026-03-10', 11.5],
    'mar 20' => ['2026-03-20', 10.5],
    'dec 1' => ['2026-12-01', 1.0],
    'before year' => ['2025-06-01', 14.0],
]);

it('provisions rows with proration and zero for contractors', function () {
    $e = makeUser('employee', ['joined_on' => '2026-03-20'])->employee;
    $c = makeUser('employee', ['joined_on' => '2026-01-01', 'employment_type' => 'contractor'])->employee;
    expect((new ProvisionBalances)($e, 2026))->toBe(2);
    expect((new ProvisionBalances)($e, 2026))->toBe(0);
    (new ProvisionBalances)($c, 2026);
    expect((float) LeaveBalance::where(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id])->value('entitled'))->toBe(10.5);
    expect((float) LeaveBalance::where(['employee_id' => $c->id, 'leave_type_id' => $this->annual->id])->value('entitled'))->toBe(0.0);
});

it('rolls over with cap, no carry when flag off, idempotent', function () {
    $e = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    LeaveBalance::create(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id, 'year' => 2026, 'entitled' => 14, 'used' => 2, 'pending' => 3]);
    LeaveBalance::create(['employee_id' => $e->id, 'leave_type_id' => $this->casual->id, 'year' => 2026, 'entitled' => 8, 'used' => 1, 'pending' => 0]);
    $r = (new RolloverYear)(2026);
    $row = fn ($t) => LeaveBalance::where(['employee_id' => $e->id, 'leave_type_id' => $t->id, 'year' => 2027])->firstOrFail();
    expect((float) $row($this->annual)->carried_in)->toBe(7.0)
        ->and((float) $row($this->annual)->entitled)->toBe(14.0)
        ->and((float) $row($this->casual)->carried_in)->toBe(0.0);
    $again = (new RolloverYear)(2026);
    expect($again['created'])->toBe(0)->and($r['created'])->toBeGreaterThan(0);
    expect(LeaveBalance::where('year', 2027)->count())->toBe($r['created']);
    expect(ActivityLogEntry::where('subject_type', 'leave_rollover')->count())->toBe(2);
});

it('carries only what is unused below the cap', function () {
    $e = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    LeaveBalance::create(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id, 'year' => 2026, 'entitled' => 14, 'carried_in' => 2, 'used' => 12, 'pending' => 0]);
    (new RolloverYear)(2026);
    expect((float) LeaveBalance::where(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id, 'year' => 2027])->value('carried_in'))->toBe(4.0);
});

it('rejects probation-restricted leave types', function () {
    $u = makeUser('employee', ['joined_on' => '2026-10-01', 'status' => 'probation', 'probation_until' => '2027-01-01']);
    $body = fn ($t) => ['leave_type_id' => $t->id, 'starts_on' => '2026-11-16', 'ends_on' => '2026-11-16', 'half_day' => 'none', 'reason' => 'Trip'];
    $this->actingAs($u)->post(route('leave.store'), $body($this->annual))
        ->assertSessionHasErrors(['leave' => 'This leave type is not available during probation.']);
    $this->actingAs($u)->post(route('leave.store'), $body($this->casual))->assertSessionHasNoErrors();
    $u->employee->update(['status' => 'active', 'probation_until' => '2026-11-01']);
    $this->actingAs($u)->post(route('leave.store'), [...$body($this->annual), 'starts_on' => '2026-11-17', 'ends_on' => '2026-11-17'])->assertSessionHasNoErrors();
});

it('computes and consumes encashment', function () {
    $e = makeUser('employee', ['joined_on' => '2020-01-01'])->employee;
    $hr = makeUser('hr')->employee;
    LeaveBalance::create(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id, 'year' => 2026, 'entitled' => 14, 'carried_in' => 3, 'used' => 5, 'pending' => 0]);
    LeaveBalance::create(['employee_id' => $e->id, 'leave_type_id' => $this->casual->id, 'year' => 2026, 'entitled' => 8, 'used' => 0, 'pending' => 0]);
    $r = Encashment::for($e, 2026);
    expect($r['days'])->toBe(12.0)->and($r['by_type'])->toHaveCount(1);
    expect(Encashment::consume($e, 2026, $hr)['days'])->toBe(12.0);
    expect(Encashment::for($e, 2026)['days'])->toBe(0.0);
    expect((float) LeaveBalance::where(['employee_id' => $e->id, 'leave_type_id' => $this->annual->id])->value('encashed'))->toBe(12.0);
    expect(Encashment::consume($e, 2026, $hr)['days'])->toBe(0.0);
});
