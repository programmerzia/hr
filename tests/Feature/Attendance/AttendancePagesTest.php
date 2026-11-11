<?php

use App\Domain\Attendance\Actions\StartWork;
use App\Domain\Attendance\Support\Badges;
use App\Models\AttendanceDay;
use App\Models\RegularizationRequest;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 40)));

/** A lead with a team of one employee; the employee has a late day today. */
function leadWithMember(): array
{
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $lead->employee->update(['team_id' => $team->id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    app(StartWork::class)($member->employee);

    return [$lead, $member, $team];
}

it('renders my day with the expected props', function () {
    $u = makeUser();
    app(StartWork::class)($u->employee);
    $this->actingAs($u)->get(route('attendance.my-day'))->assertInertia(fn (Assert $p) => $p
        ->component('Attendance/MyDayPage')
        ->hasAll(['server_time', 'day', 'segments', 'totals', 'task_entries', 'week', 'tasks', 'policy', 'regularizations', 'shift'])
        ->has('week', 7)
        ->where('day.status', 'working')
        ->where('totals.work_seconds', 0));
});

it('employee cannot open team pages', function () {
    $u = makeUser();
    foreach (['attendance.team', 'attendance.team.history', 'attendance.team.history.csv', 'attendance.regularizations'] as $r) {
        $this->actingAs($u)->get(route($r))->assertForbidden();
    }
    $this->actingAs($u)->post(route('attendance.regularizations.decide'), [])->assertForbidden();
});

it('lead sees only their team members with presence', function () {
    [$lead, $member] = leadWithMember();
    makeUser('employee'); // outside the team
    $member->forceFill(['last_seen_at' => now()->subMinutes(15)])->save();

    $this->actingAs($lead)->get(route('attendance.team'))->assertInertia(fn (Assert $p) => $p
        ->component('Attendance/TeamPage')
        ->hasAll(['server_time', 'members', 'teams'])
        ->has('members', 2)
        ->where('members', fn ($m) => collect($m)->firstWhere('employee.id', $member->employee_id)['presence'] === 'offline'));
});

it('hr sees everyone', function () {
    leadWithMember();
    $hr = makeUser('hr');
    $this->actingAs($hr)->get(route('attendance.team'))->assertInertia(fn (Assert $p) => $p->has('members', 3));
});

it('renders team history with filters and rows', function () {
    [$lead, $member] = leadWithMember();
    $this->actingAs($lead)->get(route('attendance.team.history', ['from' => '2026-11-01', 'to' => '2026-11-12']))
        ->assertInertia(fn (Assert $p) => $p
            ->component('Attendance/TeamHistoryPage')
            ->hasAll(['filters', 'rows', 'total', 'members', 'teams', 'heat'])
            ->has('rows', 1)
            ->where('rows.0.employee.id', $member->employee_id)
            ->has('rows.0.totals.offline_seconds'));
});

it('exports team history as csv', function () {
    [$lead, $member] = leadWithMember();
    $res = $this->actingAs($lead)->get(route('attendance.team.history.csv', ['from' => '2026-11-12', 'to' => '2026-11-12']));
    $res->assertOk();
    expect($res->headers->get('content-type'))->toContain('text/csv');
    $body = $res->streamedContent();
    expect($body)->toContain('Offline (min)')->and($body)->toContain($member->employee->name);
});

it('regularization request then approval clears the late mark', function () {
    [$lead, $member] = leadWithMember();
    $day = AttendanceDay::where('employee_id', $member->employee_id)->first();
    expect($day->late_minutes)->toBeGreaterThan(0);

    $this->actingAs($lead)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'x'])->assertForbidden();
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => ''])->assertSessionHasErrors('reason');
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Bus strike'])->assertRedirect();
    $req = RegularizationRequest::firstOrFail();
    expect($req->status)->toBe('pending');

    // a second pending request is refused
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'again'])->assertSessionHas('error');
    expect(RegularizationRequest::count())->toBe(1);

    expect(Badges::for($lead))->toBe(['regularizations' => 1]);
    expect(Badges::for($member))->toBe(['regularizations' => 0]);

    $this->actingAs($lead)->get(route('attendance.regularizations'))->assertInertia(fn (Assert $p) => $p
        ->component('Attendance/RegularizationsPage')->has('requests', 1)->where('requests.0.person.name', $member->employee->name));

    // the requester cannot decide, and an outsider lead cannot either
    $this->actingAs($member)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved'])->assertForbidden();
    $other = makeUser('team_lead');
    $this->actingAs($other)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved'])->assertForbidden();

    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'rejected', 'note' => ''])->assertSessionHasErrors('note');
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved', 'note' => ' ok '])->assertRedirect();
    expect($req->fresh())->status->toBe('approved')->note->toBe('ok')->decided_by->toBe($lead->employee_id);
    expect($day->fresh()->is_regularized)->toBeTrue();
    expect(Badges::for($lead))->toBe(['regularizations' => 0]);
});

it('rejecting keeps the day unregularized', function () {
    [$lead, $member] = leadWithMember();
    $day = AttendanceDay::where('employee_id', $member->employee_id)->first();
    $req = RegularizationRequest::create(['attendance_day_id' => $day->id, 'employee_id' => $member->employee_id, 'reason' => 'r', 'status' => 'pending']);
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'rejected', 'note' => 'No'])->assertRedirect();
    expect($req->fresh()->status)->toBe('rejected')->and($day->fresh()->is_regularized)->toBeFalse();
});
