<?php

use App\Domain\Attendance\Actions\EndDay;
use App\Domain\Attendance\Actions\StartWork;
use App\Domain\Attendance\Services\DayState;
use App\Models\AttendanceDay;
use App\Models\Team;
use App\Models\TimeSegment;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 40)));

it('renders the login page with demo accounts', function () {
    makeUser('hr');
    $this->get(route('login'))->assertInertia(fn (Assert $p) => $p->component('Auth/LoginPage', false)->has('demo_accounts', 1));
});

it('login starts the work day with late minutes', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password'])->assertRedirect(route('home'));
    $this->assertAuthenticatedAs($u);
    $day = DayState::find($u->employee);
    expect($day->status)->toBe('working')->and($day->late_minutes)->toBe(40);
    expect(TimeSegment::where('attendance_day_id', $day->id)->whereNull('ended_at')->value('type'))->toBe('work');
});

it('rejects a wrong password', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'nope'])->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('login on a day ended before the standard hours just continues it', function () {
    $u = makeUser();
    $this->travelTo(now()->setTime(10, 0));
    app(StartWork::class)($u->employee);
    $this->travelTo(now()->setTime(10, 15));
    app(EndDay::class)($u->employee);
    $this->travelTo(now()->setTime(10, 16));

    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password'])->assertRedirect(route('home'));
    $day = DayState::find($u->employee);
    expect($day->status)->toBe('working')->and($day->last_out_at)->toBeNull()->and((int) $day->early_minutes)->toBe(0)
        ->and(TimeSegment::whereNull('ended_at')->value('note'))->toBeNull()
        ->and(TimeSegment::where('break_category', 'signed_out')->where('note', 'Ended the day, then continued')->count())->toBe(1);
});

it('login on a day ended after the standard hours needs overtime confirmation', function () {
    $u = makeUser();
    app(StartWork::class)($u->employee);
    DayState::find($u->employee)->update(['work_seconds' => 8 * 3600]);
    app(EndDay::class)($u->employee);
    DayState::find($u->employee)->update(['work_seconds' => 8 * 3600]);

    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password'])
        ->assertSessionHasErrors('needs_overtime_confirm');
    $this->assertGuest();

    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password', 'confirm_overtime' => true])
        ->assertRedirect(route('home'));
    expect(DayState::find($u->employee)->status)->toBe('working')
        ->and(TimeSegment::whereNull('ended_at')->value('note'))->toBe('Overtime session');
});

it('logout with break opens a break segment', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->travel(30)->minutes();
    $this->post(route('logout'), ['mode' => 'break', 'break_category' => 'lunch'])->assertRedirect(route('login'));
    $this->assertGuest();
    $day = DayState::find($u->employee);
    expect($day->status)->toBe('on_break')->and($day->work_seconds)->toBe(1800);
    $open = $day->openSegment();
    expect($open->type)->toBe('break')->and($open->break_category)->toBe('lunch')->and($open->source)->toBe('logout');
});

it('logout with end_day ends the day', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->travel(2)->hours();
    $this->post(route('logout'), ['mode' => 'end_day']);
    $day = DayState::find($u->employee);
    expect($day->status)->toBe('ended')->and($day->last_out_at)->not->toBeNull()
        ->and($day->work_seconds)->toBe(7200)->and($day->openSegment())->toBeNull();
});

it('heartbeat after an idle gap records an offline segment and resumes work', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->travel(2)->minutes();
    $this->post(route('heartbeat'))->assertRedirect();
    $this->travel(25)->minutes();
    $this->from('/')->post(route('heartbeat'))->assertRedirect('/');

    $day = DayState::find($u->employee);
    $offline = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->first();
    expect($offline)->not->toBeNull()
        ->and($offline->ended_at->getTimestamp() - $offline->started_at->getTimestamp())->toBe(1500)
        ->and($day->status)->toBe('working')
        ->and($day->openSegment()->type)->toBe('work');
});

it('sweep opens an idle break and the next heartbeat turns it offline and resumes work', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->travel(12)->minutes();
    $this->artisan('attendance:sweep')->assertSuccessful();
    $day = DayState::find($u->employee);
    expect($day->status)->toBe('on_break')->and($day->openSegment()->break_category)->toBe('idle');

    $this->post(route('heartbeat'));
    $day->refresh();
    expect($day->status)->toBe('working')
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->count())->toBe(1)
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'idle')->count())->toBe(0);
});

it('attendance actions move the day between states', function () {
    $u = makeUser();
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->post(route('attendance.break'), ['category' => 'tea'])->assertRedirect();
    expect(DayState::find($u->employee)->status)->toBe('on_break');
    $this->post(route('attendance.resume'))->assertRedirect();
    expect(DayState::find($u->employee)->status)->toBe('working');
    $this->post(route('attendance.end-day'))->assertRedirect();
    expect(DayState::find($u->employee)->status)->toBe('ended');
});

it('shares auth, nav and attendance props', function () {
    $u = makeUser('team_lead');
    $this->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
    $this->get(route('home'))->assertInertia(fn (Assert $p) => $p->component('Home/HomePage', false)
        ->where('auth.role', 'team_lead')
        ->where('auth.abilities', ['view_team', 'approve_leave_lead', 'verify_claims', 'manage_projects'])
        ->where('nav.1.id', 'team')
        ->where('attendance.day.status', 'working')
        ->where('attendance.policy.shift_start', '10:00')
        ->has('attendance.server_time')
        ->has('ziggy'));
});

it('must_change_password redirects to the account page', function () {
    $u = makeUser(user: ['must_change_password' => true]);
    $this->actingAs($u)->get(route('home'))->assertRedirect(route('account.password'));
    $this->actingAs($u)->get(route('account.password'))->assertOk();

    $this->actingAs($u)->post(route('account.password.update'), ['current' => 'password', 'next' => 'short'])
        ->assertSessionHasErrors('next');
    $this->actingAs($u)->post(route('account.password.update'), ['current' => 'password', 'next' => 'longenough1'])
        ->assertRedirect(route('home'));
    expect($u->fresh()->must_change_password)->toBeFalse();
});

it('denies an employee viewing another team day; lead sees own team only', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser(employee: ['team_id' => $team->id]);
    $other = makeUser();
    $day = AttendanceDay::create(['employee_id' => $member->employee_id, 'date' => '2026-11-12', 'status' => 'working']);

    expect($other->can('view', $day))->toBeFalse()
        ->and($member->can('view', $day))->toBeTrue()
        ->and($lead->can('view', $day))->toBeTrue()
        ->and($lead->can('regularize', $day))->toBeTrue()
        ->and($other->can('view', $member->employee))->toBeFalse();
});

it('shares work seconds as of server time, so the top bar timer never double counts the running segment', function () {
    $u = makeUser();
    $this->travelTo(now()->setTime(9, 0));
    app(StartWork::class)($u->employee);
    $this->travelTo(now()->setTime(11, 0));
    DayState::rollup(DayState::find($u->employee), now()); // stored total now includes 2h of the open segment
    $this->travelTo(now()->setTime(12, 0));
    $this->actingAs($u)->get(route('attendance.my-day'))
        ->assertInertia(fn ($p) => $p->where('attendance.work_seconds', 3 * 3600));
});
