<?php

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\EndDay;
use App\Domain\Attendance\Actions\StartWork;
use App\Models\AttendanceDay;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollPolicy;
use App\Models\RegularizationRequest;
use App\Models\Team;

function teamOfOne(): array
{
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);

    return [$lead, $member];
}

function absentDay($member): AttendanceDay
{
    app(CloseDay::class)('2026-11-11');

    return AttendanceDay::where('employee_id', $member->employee_id)->whereDate('date', '2026-11-11')->firstOrFail();
}

function requestAndDecide($test, $lead, $member, AttendanceDay $day, string $kind, array $decide)
{
    $test->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Sick', 'kind' => $kind])
        ->assertSessionHasNoErrors()->assertSessionMissing('error');
    $req = RegularizationRequest::where('attendance_day_id', $day->id)->where('status', 'pending')->firstOrFail();
    expect($req->kind)->toBe($kind);

    return [$req, $test->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved', ...$decide])];
}

it('start work marks half day past the threshold; end day writes early minutes', function () {
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(12, 30));
    app(StartWork::class)($u->employee);
    $day = AttendanceDay::firstOrFail();
    expect($day)->late_minutes->toBe(150)->day_fraction->toBe(0.5)->absence_kind->toBe('half_day');

    $this->travelTo(now()->setTime(17, 30));
    app(EndDay::class)($u->employee);
    expect($day->fresh())->early_minutes->toBe(90)->day_fraction->toBe(0.5)->absence_kind->toBe('half_day');
});

it('end day on a full day keeps it full', function () {
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(10, 0));
    app(StartWork::class)($u->employee);
    $this->travelTo(now()->setTime(19, 0));
    app(EndDay::class)($u->employee);
    expect(AttendanceDay::firstOrFail())->early_minutes->toBe(0)->day_fraction->toBe(1.0)->absence_kind->toBe('none');
});

it('absent + excused makes the day full', function () {
    [$lead, $member] = teamOfOne();
    $day = absentDay($member);
    [$req, $res] = requestAndDecide($this, $lead, $member, $day, 'absent', ['resolution' => 'excused']);
    $res->assertSessionHasNoErrors();
    expect($req->fresh())->resolution->toBe('excused')
        ->and($day->fresh())->is_regularized->toBeTrue()->day_fraction->toBe(1.0)->absence_kind->toBe('excused');
});

it('absent + paid leave books leave and uses balance', function () {
    [$lead, $member] = teamOfOne();
    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    $day = absentDay($member);
    [$req, $res] = requestAndDecide($this, $lead, $member, $day, 'absent', ['resolution' => 'paid_leave', 'leave_type_id' => $type->id]);
    $res->assertSessionHasNoErrors();
    expect($req->fresh())->resolution->toBe('paid_leave')->leave_type_id->toBe($type->id)
        ->and($day->fresh())->day_fraction->toBe(1.0)->absence_kind->toBe('paid_leave');
    $leave = LeaveRequest::firstOrFail();
    expect($leave)->status->toBe('approved')->reason->toBe('Regularised absence')->and((float) $leave->days)->toBe(1.0);
    expect((float) LeaveBalance::where('employee_id', $member->employee_id)->first()->used)->toBe(1.0);
});

it('absent + unpaid leave stays zero', function () {
    [$lead, $member] = teamOfOne();
    $day = absentDay($member);
    [, $res] = requestAndDecide($this, $lead, $member, $day, 'absent', ['resolution' => 'unpaid_leave']);
    $res->assertSessionHasNoErrors();
    expect($day->fresh())->day_fraction->toBe(0.0)->absence_kind->toBe('unpaid_leave')->is_regularized->toBeTrue();
});

it('auto-closed + keep leaves the grade unchanged', function () {
    [$lead, $member] = teamOfOne();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(10, 0));
    app(StartWork::class)($member->employee);
    $member->forceFill(['last_seen_at' => now()->setTime(13, 0)])->save();
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(0, 10));
    app(CloseDay::class)();
    $day = AttendanceDay::where('employee_id', $member->employee_id)->whereDate('date', '2026-11-11')->firstOrFail();
    [, $res] = requestAndDecide($this, $lead, $member, $day, 'auto_closed', ['resolution' => 'keep']);
    $res->assertSessionHasNoErrors();
    expect($day->fresh())->day_fraction->toBe(0.5)->absence_kind->toBe('half_day');
});

it('early + excused clears early minutes', function () {
    [$lead, $member] = teamOfOne();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(9, 30));
    app(StartWork::class)($member->employee);
    $this->travelTo(now()->setTime(18, 0));
    app(EndDay::class)($member->employee);
    $day = AttendanceDay::firstOrFail();
    expect($day->early_minutes)->toBe(60);
    [, $res] = requestAndDecide($this, $lead, $member, $day, 'early', []);
    $res->assertSessionHasNoErrors();
    expect($day->fresh())->early_minutes->toBe(0)->absence_kind->toBe('excused');
});

it('refuses kinds that do not apply to the day', function () {
    [, $member] = teamOfOne();
    $day = absentDay($member);
    foreach (['late', 'early', 'auto_closed'] as $kind) {
        $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'x', 'kind' => $kind])
            ->assertSessionHas('error', 'Could not send the request.');
    }
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'x', 'kind' => 'bogus'])
        ->assertSessionHasErrors('kind');
    expect(RegularizationRequest::count())->toBe(0);
});

it('validates resolution and paid leave type (422)', function () {
    [$lead, $member] = teamOfOne();
    $unpaid = LeaveType::factory()->create(['is_paid' => false, 'annual_quota' => 0]);
    $empty = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 0]);
    $day = absentDay($member);
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'x', 'kind' => 'absent']);
    $req = RegularizationRequest::firstOrFail();
    $url = route('attendance.regularizations.decide');
    $lead = $this->actingAs($lead);

    $lead->postJson($url, ['id' => $req->id, 'decision' => 'approved', 'resolution' => 'nope'])->assertStatus(422)->assertJsonValidationErrors('resolution');
    $lead->postJson($url, ['id' => $req->id, 'decision' => 'approved', 'resolution' => 'paid_leave'])->assertStatus(422)->assertJsonValidationErrors(['leave_type_id' => 'Pick a paid leave type.']);
    $lead->postJson($url, ['id' => $req->id, 'decision' => 'approved', 'resolution' => 'paid_leave', 'leave_type_id' => $unpaid->id])->assertStatus(422)->assertJsonValidationErrors(['leave_type_id' => 'Pick a paid leave type.']);
    $lead->postJson($url, ['id' => $req->id, 'decision' => 'approved', 'resolution' => 'paid_leave', 'leave_type_id' => $empty->id])->assertStatus(422)->assertJsonValidationErrors(['leave_type_id' => 'Not enough leave balance.']);

    expect($req->fresh()->status)->toBe('pending')->and(LeaveRequest::count())->toBe(0)->and($day->fresh()->is_regularized)->toBeFalse();
});

it('my day exposes late rule and regularisable days', function () {
    PayrollPolicy::current()->update(['late_penalty_enabled' => true]);
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(10, 40));
    app(StartWork::class)($u->employee);
    app(CloseDay::class)('2026-11-10');
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->actingAs($u)->get(route('attendance.my-day'))->assertInertia(fn ($p) => $p
        ->where('late_rule.enabled', true)->where('late_rule.lates_per_penalty', 3)->where('late_rule.count_this_month', 1)
        ->has('recent_days', 1)->where('recent_days.0.day.absence_kind', 'unapproved'));
});
