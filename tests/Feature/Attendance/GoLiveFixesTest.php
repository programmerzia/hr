<?php

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\DecideRegularization;
use App\Domain\Attendance\Actions\Heartbeat;
use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Attendance\Actions\StartBreak;
use App\Domain\Attendance\Services\Paused;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\RegularizationRequest;
use App\Models\Team;
use App\Models\TimeSegment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Once;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;

// Policy defaults (= prod): shift 10:00-19:00, standard 480, offline after 3, idle timeout 10, idle_by_input off.
// 2026-11-10 Tue, 11 Wed, 12 Thu, 13 Fri (weekend).

function gl(string $dt): CarbonImmutable
{
    $t = CarbonImmutable::parse($dt, config('app.timezone'));
    test()->travelTo($t);

    return $t;
}

function glLogin($test, User $u): void
{
    $test->post(route('login.store'), ['email' => $u->email, 'password' => 'password']);
}

/** Heartbeats through the action, every $step minutes from $from to $to; $activity is the client's last input. */
function glBeats(User $u, string $from, string $to, ?string $activity, int $step = 2): void
{
    for ($t = CarbonImmutable::parse($from, config('app.timezone')); $t <= CarbonImmutable::parse($to, config('app.timezone')); $t = $t->addMinutes($step)) {
        test()->travelTo($t);
        app(Heartbeat::class)($u->fresh(), $activity ? CarbonImmutable::parse($activity, config('app.timezone')) : null);
    }
}

function glDay(Employee $e, string $date): ?AttendanceDay
{
    return AttendanceDay::where('employee_id', $e->id)->whereDate('date', $date)->first();
}

function glSegs(AttendanceDay $d)
{
    return TimeSegment::where('attendance_day_id', $d->id)->orderBy('started_at')->get();
}

// ---- P0-1 overnight tab
it('presence counts at any hour: working in another app after 19:00 is work, and past 8h it is overtime', function () {
    $u = makeUser();
    gl('2026-11-10 10:00');
    glLogin($this, $u);
    // The HR tab sits minimized all day (last input 10:01) while the person works in another app until 21:00.
    glBeats($u, '2026-11-10 10:02', '2026-11-10 21:00', '2026-11-10 10:01:00');

    $day = glDay($u->employee, '2026-11-10');
    expect($day->status)->toBe('working')
        ->and(glSegs($day)->where('type', 'break')->count())->toBe(0);

    app(\App\Domain\Attendance\Actions\EndDay::class)($u->employee->fresh());
    $day = glDay($u->employee, '2026-11-10');
    expect(intdiv($day->work_seconds, 60))->toBe(11 * 60)
        ->and(\App\Domain\Attendance\Services\Overtime::raw($day->fresh()))->toBe(3 * 60);
});

it('P0-1 in-shift presence is unchanged: no input for hours is still work', function () {
    $u = makeUser();
    gl('2026-11-10 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-10 10:02', '2026-11-10 18:58', '2026-11-10 10:01:00');
    $day = glDay($u->employee, '2026-11-10');
    expect($day->status)->toBe('working')->and(glSegs($day)->where('type', 'break')->count())->toBe(0);
});

it('P0-1 work that really runs past midnight carries on, from the input time', function () {
    $u = makeUser();
    gl('2026-11-10 23:00');
    glLogin($this, $u);
    for ($t = gl('2026-11-10 23:02'); $t <= CarbonImmutable::parse('2026-11-11 00:10'); $t = $t->addMinutes(2)) {
        gl($t->format('Y-m-d H:i'));
        app(Heartbeat::class)($u->fresh(), $t->subSeconds(30));
    }
    $today = glDay($u->employee, '2026-11-11');
    expect(glDay($u->employee, '2026-11-10')->status)->toBe('ended')
        ->and($today->status)->toBe('working')
        ->and($today->first_in_at->format('H:i:s'))->toBe('00:00:00');
});


// ---- P1-1 early leave
it('P1-1 a short reopen late in the evening does not wipe out early leave', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-12 10:02', '2026-11-12 18:14', null);
    // Laptop closed at 18:14, opened again at 22:29 (page reloaded: input now), then closed.
    gl('2026-11-12 22:29');
    app(Heartbeat::class)($u->fresh(), now(), 'closed', CarbonImmutable::parse('2026-11-12 18:14:20'));
    gl('2026-11-12 22:31');
    app(Heartbeat::class)($u->fresh(), now());
    gl('2026-11-13 00:10');
    app(CloseDay::class)('2026-11-12');

    $day = glDay($u->employee, '2026-11-12');
    expect($day->status)->toBe('ended')->and($day->early_minutes)->toBe(46);
});

it('P1-1 a real evening session after a long gap still counts as coming back', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-12 10:02', '2026-11-12 18:14', null);
    gl('2026-11-12 20:00');
    app(Heartbeat::class)($u->fresh(), now(), 'closed', CarbonImmutable::parse('2026-11-12 18:14:20'));
    for ($t = gl('2026-11-12 20:02'); $t->format('H:i') <= '21:00'; $t = $t->addMinutes(2)) {
        gl($t->format('Y-m-d H:i'));
        app(Heartbeat::class)($u->fresh(), now());
    }
    gl('2026-11-13 00:10');
    app(CloseDay::class)('2026-11-12');
    expect(glDay($u->employee, '2026-11-12')->early_minutes)->toBe(0);
});

it('P1-1 a day that ends on a forgotten break measures early leave from the last work', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-12 10:02', '2026-11-12 17:00', null);
    app(StartBreak::class)($u->employee, 'tea');
    glBeats($u, '2026-11-12 17:02', '2026-11-12 17:40', null);
    gl('2026-11-13 00:10');
    app(CloseDay::class)('2026-11-12');
    expect(glDay($u->employee, '2026-11-12')->early_minutes)->toBe(120);
});

// ---- P0-2 paused tabs
it('P0-2 a gap the browser paused is offline with its own note, inferred when beats resume without a reload', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-12 10:02', '2026-11-12 11:00', '2026-11-12 10:59:00');
    // No cause reported, and the input clock is from before the gap: the page was not reloaded.
    gl('2026-11-12 11:40');
    app(Heartbeat::class)($u->fresh(), CarbonImmutable::parse('2026-11-12 10:59:00'));
    $off = glSegs(glDay($u->employee, '2026-11-12'))->where('break_category', 'offline')->sole();
    expect($off->note)->toBe(Paused::NOTE)
        ->and($off->started_at->format('H:i'))->toBe('11:00')->and($off->ended_at->format('H:i'))->toBe('11:40');
});

it('P0-2 paused time shows on My day and can be asked, and approved, to count as work', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $u = makeUser('employee', ['team_id' => $team->id]);
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    glBeats($u, '2026-11-12 10:02', '2026-11-12 11:00', null);
    gl('2026-11-12 11:30');
    $this->actingAs($u->fresh())->post(route('heartbeat'), ['gap_reason' => 'suspended', 'gap_since' => '2026-11-12 11:00:20']);

    $day = glDay($u->employee, '2026-11-12');
    $this->get('/my-day')->assertInertia(fn (Assert $p) => $p
        ->where('recent_days.0.day.id', $day->id)->where('recent_days.0.paused_minutes', 29));

    // Today is still running: a paused request is still allowed.
    $this->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Was in a meeting doc', 'kind' => 'paused'])
        ->assertSessionHas('success');
    $req = RegularizationRequest::where('attendance_day_id', $day->id)->sole();
    $before = (int) $day->refresh()->work_seconds;

    expect(app(DecideRegularization::class)($req, 'approved', null, $lead->employee))->toBeTrue();
    $day->refresh();
    expect(glSegs($day)->where('break_category', 'offline')->count())->toBe(0)
        ->and(glSegs($day)->where('source', 'correction')->count())->toBe(1)
        ->and((int) $day->work_seconds)->toBeGreaterThanOrEqual($before + 29 * 60)
        ->and($day->is_regularized)->toBeFalse();
});

// ---- P1-3 strict idle across tabs
it('P1-3 strict idle uses the latest input from any tab', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    AttendancePolicy::forDate('2026-11-12')->update(['idle_by_input' => true]);
    Once::flush();
    glLogin($this, $u);
    foreach (['10:02', '10:04', '10:05'] as $t) {
        gl("2026-11-12 {$t}");
        app(Heartbeat::class)($u->fresh(), now()); // tab A: typing
    }
    glBeats($u, '2026-11-12 10:07', '2026-11-12 10:13', '2026-11-12 10:01:00', 3); // tab B: untouched
    expect(glDay($u->employee, '2026-11-12')->status)->toBe('working');
    gl('2026-11-12 10:16');
    app(Heartbeat::class)($u->fresh(), CarbonImmutable::parse('2026-11-12 10:01:00'));
    $day = glDay($u->employee, '2026-11-12');
    expect($day->status)->toBe('on_break')->and($day->openSegment()->started_at->format('H:i'))->toBe('10:05');
});

// ---- P1-4 start prompt
it('P1-4 the app is told to ask "Start your day?" only on an unstarted working day', function () {
    $u = makeUser();
    gl('2026-11-12 09:30');
    $this->actingAs($u)->get('/my-day')->assertInertia(fn (Assert $p) => $p->where('attendance.start_prompt', true));
    expect(glDay($u->employee, '2026-11-12'))->toBeNull(); // asking starts nothing
    $this->post(route('attendance.resume'));
    $this->get('/my-day')->assertInertia(fn (Assert $p) => $p->where('attendance.start_prompt', false));
    gl('2026-11-13 10:30'); // Friday: weekend
    $this->get('/my-day')->assertInertia(fn (Assert $p) => $p->where('attendance.start_prompt', false));
    gl('2026-11-11 19:30'); // past shift end
    $this->get('/my-day')->assertInertia(fn (Assert $p) => $p->where('attendance.start_prompt', false));
});

// ---- P2-1 sweep
it('P2-1 the sweep re-checks under the lock and never opens a second break', function () {
    $u = makeUser();
    gl('2026-11-12 10:00');
    glLogin($this, $u);
    gl('2026-11-12 10:05');
    $this->artisan('attendance:sweep')->assertSuccessful();
    $this->artisan('attendance:sweep')->assertSuccessful();
    $day = glDay($u->employee, '2026-11-12');
    expect(glSegs($day)->where('source', 'idle_sweep')->count())->toBe(1)->and($day->status)->toBe('on_break');
});

// ---- P2-2 outage
it('P2-2 without any scheduler runs, a silent gap is never an outage', function () {
    $a = makeUser();
    $b = makeUser();
    $c = makeUser();
    foreach ([$a, $b, $c] as $u) {
        gl('2026-11-12 10:00');
        glLogin($this, $u);
        auth()->logout();
    }
    foreach ([$a, $b, $c] as $u) {
        glBeats($u, '2026-11-12 10:01', '2026-11-12 10:09', null, 1);
    }
    gl('2026-11-12 10:20');
    app(Heartbeat::class)($a->fresh(), now());
    $segs = glSegs(glDay($a->employee, '2026-11-12'));
    expect($segs->where('source', 'outage')->count())->toBe(0)->and($segs->where('break_category', 'offline')->count())->toBe(1);
});

// ---- P2-4 payroll lock
it('P2-4 a locked payroll month refuses regularization, overtime, regrade and close', function () {
    PayrollPolicy::forDate('2026-10-31')->update(['overtime_enabled' => true, 'overtime_requires_approval' => true]);
    $hr = makeUser('hr');
    $u = makeUser();
    gl('2026-11-12 10:00');
    $day = AttendanceDay::create([
        'employee_id' => $u->employee_id, 'date' => '2026-10-20', 'status' => 'ended', 'closed_at' => '2026-10-21 00:10:00',
        'first_in_at' => '2026-10-20 10:00:00', 'last_out_at' => '2026-10-20 21:00:00', 'work_seconds' => 660 * 60, 'early_minutes' => 0,
    ]);
    $req = RegularizationRequest::create(['attendance_day_id' => $day->id, 'employee_id' => $u->employee_id, 'reason' => 'x', 'kind' => 'auto_closed', 'status' => 'pending']);
    PayrollRun::create(['year' => 2026, 'month' => 10, 'status' => 'approved', 'kind' => 'regular']);

    $this->actingAs($hr)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved'])
        ->assertSessionHas('error', 'Payroll for October 2026 is already approved; ask HR to adjust it there.');
    expect($req->refresh()->status)->toBe('pending');
    expect(fn () => app(DecideRegularization::class)($req, 'approved', null, $hr->employee))->toThrow(ValidationException::class);

    $this->post(route('attendance.overtime.approve', $day), ['minutes' => 60])->assertSessionHasErrors('minutes');
    $this->post(route('attendance.overtime.revoke', $day))->assertSessionHas('error');
    expect($day->refresh()->approved_overtime_minutes)->toBe(0);

    expect(fn () => app(RegradeDays::class)($u->employee_id, '2026-10-01', '2026-10-31'))->toThrow(ValidationException::class);

    $open = AttendanceDay::create(['employee_id' => $u->employee_id, 'date' => '2026-10-21', 'status' => 'working', 'first_in_at' => '2026-10-21 10:00:00']);
    expect(app(CloseDay::class)('2026-10-21'))->toBe(0)->and($open->refresh()->status)->toBe('working');
    // An open month still regrades.
    expect(app(RegradeDays::class)($u->employee_id, '2026-11-10', '2026-11-10'))->toBeGreaterThanOrEqual(0);
});
