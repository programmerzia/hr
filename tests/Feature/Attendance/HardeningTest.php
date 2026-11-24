<?php

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\DecideRegularization;
use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Attendance\Actions\StartWork;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\RegularizationRequest;
use App\Models\Team;
use App\Models\TimeSegment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Once;
use Inertia\Testing\AssertableInertia as Assert;

// 2026-11-10 Tue, 11 Wed, 12 Thu, 13 Fri (weekend), 22 Sun.
function at(string $dt): void
{
    test()->travelTo(CarbonImmutable::parse($dt, config('app.timezone')));
}

function signIn($test, $u, array $extra = []): void
{
    $test->post(route('login.store'), ['email' => $u->email, 'password' => 'password', ...$extra]);
}

/** One heartbeat a minute from $from to $to (inclusive), all reporting the same last input time. */
function beats($test, string $from, string $to, ?string $activity): void
{
    for ($t = CarbonImmutable::parse($from, config('app.timezone')); $t <= CarbonImmutable::parse($to, config('app.timezone')); $t = $t->addMinute()) {
        test()->travelTo($t);
        $test->post(route('heartbeat'), $activity ? ['last_activity_at' => $activity] : []);
    }
}

/** Turns on input-based ("strict") idle for the policy in force on $date; presence is the default. */
function strictIdle(string $date = '2026-11-12'): void
{
    AttendancePolicy::forDate($date)->update(['idle_by_input' => true]);
    Once::flush();
}

function rowOf(Employee $e, string $date): ?AttendanceDay
{
    return AttendanceDay::where('employee_id', $e->id)->whereDate('date', $date)->first();
}

function staleDay(Employee $e, string $date, string $status = 'working', ?string $activity = '12:00:00', string $start = '10:00:00'): AttendanceDay
{
    $d = AttendanceDay::create([
        'employee_id' => $e->id, 'date' => $date, 'status' => $status, 'first_in_at' => "$date $start",
        'last_activity_at' => $activity ? "$date $activity" : null,
    ]);
    TimeSegment::create([
        'attendance_day_id' => $d->id, 'type' => $status === 'on_break' ? 'break' : 'work',
        'break_category' => $status === 'on_break' ? 'lunch' : null, 'started_at' => "$date $start", 'source' => 'login',
    ]);

    return $d;
}

// ---- A1
it('A1 login after a lost session credits the gap as offline, not work', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:05', null);
    auth()->logout();
    at('2026-11-12 10:25');
    signIn($this, $u);

    $day = rowOf($u->employee, '2026-11-12');
    $off = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->first();
    expect($off)->not->toBeNull()
        ->and($off->started_at->format('H:i'))->toBe('10:05')->and($off->ended_at->format('H:i'))->toBe('10:25')
        ->and($day->status)->toBe('working')
        ->and($day->openSegment()->started_at->format('H:i'))->toBe('10:25');
});

// ---- A2
it('A2a heartbeat closes the employee\'s own stale past day', function () {
    $u = makeUser();
    at('2026-11-10 09:00');
    $stale = staleDay($u->employee, '2026-11-10');
    $u->forceFill(['last_seen_at' => '2026-11-10 12:00:00'])->save();
    at('2026-11-12 09:30');
    $this->actingAs($u)->post(route('heartbeat'));

    $stale->refresh();
    expect($stale->status)->toBe('ended')->and($stale->auto_closed)->toBeTrue()->and($stale->closed_at)->not->toBeNull()
        ->and($stale->last_out_at->format('Y-m-d H:i'))->toBe('2026-11-10 12:00')
        ->and($stale->openSegment())->toBeNull();
});

it('A2a login closes the stale past day and starts today', function () {
    $u = makeUser();
    at('2026-11-10 09:00');
    $stale = staleDay($u->employee, '2026-11-10', 'on_break', '13:00:00');
    at('2026-11-12 09:30');
    signIn($this, $u);

    expect($stale->refresh()->status)->toBe('ended')->and(rowOf($u->employee, '2026-11-12')->status)->toBe('working');
});

it('A2b history never extends a past open segment past the close time', function () {
    $hr = makeUser('hr');
    $u = makeUser();
    at('2026-11-10 09:00');
    staleDay($u->employee, '2026-11-10');
    at('2026-11-22 09:00');
    $this->actingAs($hr)->get(route('attendance.team.history', ['from' => '2026-11-10', 'to' => '2026-11-10']))
        ->assertInertia(fn (Assert $p) => $p->where('rows.0.totals.work_seconds', 7200));
});

// ---- A3
it('A3 close time uses the day\'s last activity, not the user\'s current last_seen_at', function () {
    $u = makeUser();
    at('2026-11-10 09:00');
    $d = staleDay($u->employee, '2026-11-10', 'on_break', '15:00:00');
    $u->forceFill(['last_seen_at' => '2026-11-11 22:00:00'])->save();
    at('2026-11-11 00:10');
    app(CloseDay::class)('2026-11-10');
    expect($d->refresh()->last_out_at->format('H:i'))->toBe('15:00');
});

it('A3 close time falls back to the open segment start without any activity record', function () {
    $u = makeUser();
    at('2026-11-10 09:00');
    $d = staleDay($u->employee, '2026-11-10', 'working', null);
    at('2026-11-11 00:10');
    app(CloseDay::class)('2026-11-10');
    expect($d->refresh()->last_out_at->format('H:i'))->toBe('10:00');
});

it('A3 heartbeat and start stamp last_activity_at on the day', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:07');
    $this->post(route('heartbeat'));
    expect(rowOf($u->employee, '2026-11-12')->last_activity_at->format('H:i'))->toBe('10:07');
});

// ---- A4
it('A4 closes a contractor\'s running day but creates nothing else for contractors', function () {
    $c = makeUser('employee', ['employment_type' => 'contractor']);
    $c2 = makeUser('employee', ['employment_type' => 'contractor']);
    at('2026-11-10 09:00');
    $d = staleDay($c->employee, '2026-11-10', 'on_break', '13:00:00');
    at('2026-11-11 00:10');
    app(CloseDay::class)('2026-11-10');
    expect($d->refresh()->status)->toBe('ended')->and($d->closed_at)->not->toBeNull()
        ->and(rowOf($c2->employee, '2026-11-10'))->toBeNull()
        ->and($c->notifications()->get()->pluck('data.title')->contains(fn ($t) => str_contains($t, 'absent')))->toBeFalse();
});

// ---- A5
it('A5 weekend and holiday sign-in is not graded late or half day', function () {
    $u = makeUser();
    at('2026-11-13 14:00'); // Friday
    app(StartWork::class)($u->employee);
    expect(rowOf($u->employee, '2026-11-13'))->late_minutes->toBe(0)->absence_kind->toBe('none');

    $h = makeUser();
    Holiday::create(['date' => '2026-11-12', 'name' => 'Test']);
    at('2026-11-12 14:00');
    app(StartWork::class)($h->employee);
    expect(rowOf($h->employee, '2026-11-12'))->late_minutes->toBe(0)->absence_kind->toBe('none');
});

it('A5 first-half leave means no late mark at sign-in', function () {
    $u = makeUser();
    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    LeaveRequest::factory()->create(['employee_id' => $u->employee_id, 'leave_type_id' => $type->id, 'starts_on' => '2026-11-12', 'ends_on' => '2026-11-12', 'half_day' => 'first_half', 'status' => 'approved']);
    at('2026-11-12 14:00');
    app(StartWork::class)($u->employee);
    expect(rowOf($u->employee, '2026-11-12'))->late_minutes->toBe(0)->absence_kind->toBe('none');
});

it('A5 no "closed automatically" notification for a weekend day', function () {
    $u = makeUser();
    at('2026-11-13 11:00');
    app(StartWork::class)($u->employee);
    at('2026-11-14 00:10');
    app(CloseDay::class)('2026-11-13');
    expect($u->notifications()->count())->toBe(0);
});

// ---- A6 / A7
it('A6 a heartbeat with stale client activity opens an idle break from the last input', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    strictIdle();
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:13', '2026-11-12 10:02:00');

    $day = rowOf($u->employee, '2026-11-12');
    $open = $day->openSegment();
    expect($day->status)->toBe('on_break')->and($open->break_category)->toBe('idle')->and($open->source)->toBe('idle')
        ->and($open->started_at->format('H:i'))->toBe('10:02')->and($day->work_seconds)->toBe(120);
});

it('A6 with idle_by_input off the client activity time is ignored', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    AttendancePolicy::forDate('2026-11-12')->update(['idle_by_input' => false]);
    Once::flush();
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:13', '2026-11-12 10:02:00');

    $day = rowOf($u->employee, '2026-11-12');
    expect($day->status)->toBe('working')->and($day->openSegment()->break_category)->toBeNull()
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'idle')->exists())->toBeFalse();
});

it('A6 the next input closes the idle break and resumes work', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    strictIdle();
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:13', '2026-11-12 10:02:00');
    at('2026-11-12 10:14');
    $this->post(route('heartbeat'), ['last_activity_at' => '2026-11-12 10:13:30']);

    $day = rowOf($u->employee, '2026-11-12');
    $idle = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'idle')->first();
    expect($day->status)->toBe('working')->and($idle->ended_at->format('H:i:s'))->toBe('10:13:30')
        ->and($day->openSegment()->type)->toBe('work');
});

it('A6 a stale heartbeat keeps the idle break going', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    strictIdle();
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:15', '2026-11-12 10:02:00');
    expect(rowOf($u->employee, '2026-11-12')->status)->toBe('on_break');
});

it('A6 client activity time is clamped to the open segment and to now', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    strictIdle();
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:13', '2020-01-01 00:00:00');
    $open = rowOf($u->employee, '2026-11-12')->openSegment();
    expect($open->break_category)->toBe('idle')->and($open->started_at->format('H:i'))->toBe('10:00');

    auth()->logout();
    $v = makeUser();
    at('2026-11-12 11:00');
    signIn($this, $v);
    beats($this, '2026-11-12 11:01', '2026-11-12 11:30', '2030-01-01 00:00:00');
    $day = rowOf($v->employee, '2026-11-12');
    expect($day->status)->toBe('working')->and($day->last_activity_at->format('H:i'))->toBe('11:30');
});

it('A7 a sweep-opened break becomes offline when the person returns, and work resumes', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:12');
    $this->artisan('attendance:sweep')->assertSuccessful();
    at('2026-11-12 10:30');
    $this->post(route('heartbeat'));
    $day = rowOf($u->employee, '2026-11-12');
    $off = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->first();
    expect($day->status)->toBe('working')
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'idle')->count())->toBe(0)
        ->and($off->started_at->format('H:i'))->toBe('10:00')->and($off->ended_at->format('H:i'))->toBe('10:30')
        ->and($off->note)->toBe('No signal from the HR app');
});

it('A9 by default an open background tab counts as working however old the last input is', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 12:00', '2026-11-12 10:00:30');
    $day = rowOf($u->employee, '2026-11-12');
    expect($day->status)->toBe('working')
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('type', 'break')->exists())->toBeFalse()
        ->and($day->last_activity_at->format('H:i'))->toBe('12:00');
});

it('A9 a missed beat or two is still work; a 5-minute drop is offline from the last beat', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:01');
    $this->post(route('heartbeat'));
    at('2026-11-12 10:03'); // background-tab throttling: 2 min between beats
    $this->post(route('heartbeat'));
    expect(TimeSegment::where('attendance_day_id', rowOf($u->employee, '2026-11-12')->id)->where('type', 'break')->exists())->toBeFalse();
    at('2026-11-12 10:08'); // internet gone for 5 min
    $this->post(route('heartbeat'));
    $day = rowOf($u->employee, '2026-11-12');
    $off = TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->sole();
    expect($day->status)->toBe('working')->and($off->started_at->format('H:i'))->toBe('10:03')
        ->and($off->ended_at->format('H:i'))->toBe('10:08')->and($day->work_seconds)->toBe(180);
});

it('A9 the client gap start ends the work segment there, trusted only within 90 s of the last beat', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:01');
    $this->post(route('heartbeat'));
    at('2026-11-12 10:07');
    $this->post(route('heartbeat'), ['gap_reason' => 'no_internet', 'gap_since' => '2026-11-12 10:01:40']);
    $day = rowOf($u->employee, '2026-11-12');
    $segs = TimeSegment::where('attendance_day_id', $day->id)->orderBy('started_at')->get();
    expect($segs->pluck('type')->all())->toBe(['work', 'break', 'work'])
        ->and($segs[0]->ended_at->format('H:i:s'))->toBe('10:01:40')
        ->and($segs[1]->started_at->format('H:i:s'))->toBe('10:01:40')->and($segs[1]->note)->toBe('No internet connection');

    // Woke from sleep: the browser reports "offline" at wake-up time, long after the last beat. Not trusted.
    $v = makeUser();
    auth()->logout();
    at('2026-11-12 11:00');
    signIn($this, $v);
    at('2026-11-12 11:30');
    $this->post(route('heartbeat'), ['offline_since' => '2026-11-12 11:29:00']);
    $segs = TimeSegment::where('attendance_day_id', rowOf($v->employee, '2026-11-12')->id)->orderBy('started_at')->get();
    // Signed in at 11:00 and silent until 11:30: no work at all, the empty login piece is dropped.
    expect($segs->pluck('type')->all())->toBe(['break', 'work'])
        ->and($segs[0]->started_at->format('H:i'))->toBe('11:00')->and($segs[0]->ended_at->format('H:i'))->toBe('11:30');
});

it('A11 each gap reason gets its own note; no reason is "No signal"', function (?string $reason, string $note) {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:10');
    $this->post(route('heartbeat'), $reason ? ['gap_reason' => $reason, 'gap_since' => '2026-11-12 10:00:30'] : []);
    $off = TimeSegment::where('attendance_day_id', rowOf($u->employee, '2026-11-12')->id)->where('break_category', 'offline')->sole();
    expect($off->note)->toBe($note);
})->with([
    [null, 'No signal from the HR app'],
    ['no_internet', 'No internet connection'],
    ['unreachable', 'Could not reach the server (network problem)'],
    ['asleep', 'Device asleep or locked'],
    ['suspended', 'Browser paused the HR tab'],
    ['closed', 'HR app closed'],
]);

it('A11 a gap reason without a gap changes nothing', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:01');
    $this->post(route('heartbeat'), ['gap_reason' => 'closed', 'gap_since' => '2026-11-12 10:00:30']);
    expect(TimeSegment::where('attendance_day_id', rowOf($u->employee, '2026-11-12')->id)->count())->toBe(1);
});

it('A12 a wake-up beat followed by sleep leaves no zero-length work, and the sweep break is relabelled', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    at('2026-11-12 10:04');
    $this->artisan('attendance:sweep')->assertSuccessful(); // break from 10:00
    at('2026-11-12 10:20');
    $this->post(route('heartbeat'), ['gap_reason' => 'asleep', 'gap_since' => '2026-11-12 10:00:20']); // woke for a second
    at('2026-11-12 10:24');
    $this->artisan('attendance:sweep')->assertSuccessful(); // asleep again: break from 10:20
    at('2026-11-12 10:40');
    $this->post(route('heartbeat'), ['gap_reason' => 'asleep', 'gap_since' => '2026-11-12 10:20:00']);
    $segs = TimeSegment::where('attendance_day_id', rowOf($u->employee, '2026-11-12')->id)->orderBy('started_at')->get();
    expect($segs->filter(fn ($s) => $s->ended_at && $s->ended_at->eq($s->started_at))->count())->toBe(0)
        ->and($segs->where('break_category', 'offline')->pluck('note')->unique()->values()->all())->toBe(['Device asleep or locked'])
        ->and($segs->where('break_category', 'idle')->count())->toBe(0)
        ->and($segs->last()->type)->toBe('work')->and($segs->last()->ended_at)->toBeNull();
});

it('A12 closing a day whose last beat opened a sweep break leaves no empty break at the end', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    beats($this, '2026-11-12 10:01', '2026-11-12 10:30', null);
    at('2026-11-12 10:34');
    $this->artisan('attendance:sweep')->assertSuccessful();
    at('2026-11-13 00:10');
    app(CloseDay::class)->forEmployee($u->employee, '2026-11-12');
    $segs = TimeSegment::where('attendance_day_id', rowOf($u->employee, '2026-11-12')->id)->orderBy('started_at')->get();
    expect($segs)->toHaveCount(1)->and($segs[0]->type)->toBe('work')
        ->and($segs[0]->ended_at->format('H:i'))->toBe('10:30')->and(rowOf($u->employee, '2026-11-12')->work_seconds)->toBe(1800);
});

it('A10 a server outage (everyone silent) is work; the person\'s own silence around it is offline', function () {
    $a = makeUser();
    $b = makeUser();
    $c = makeUser();
    foreach ([$a, $b, $c] as $u) {
        at('2026-11-12 10:00');
        signIn($this, $u);
        auth()->logout();
    }
    // Everyone beats every minute until 10:10, nobody reaches the server 10:11-10:16, all are back at 10:17.
    for ($m = 1; $m <= 10; $m++) {
        foreach ([$a, $b, $c] as $u) {
            at(sprintf('2026-11-12 10:%02d', $m));
            $this->actingAs($u)->post(route('heartbeat'));
        }
    }
    at('2026-11-12 10:13');
    $this->artisan('attendance:sweep')->assertSuccessful();
    expect(rowOf($a->employee, '2026-11-12')->status)->toBe('working'); // no sweep during the server's own outage
    at('2026-11-12 10:17');
    foreach ([$b, $c, $a] as $u) {
        $this->actingAs($u)->post(route('heartbeat'));
    }
    $day = rowOf($a->employee, '2026-11-12');
    expect($day->status)->toBe('working')
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('break_category', 'offline')->exists())->toBeFalse()
        ->and(TimeSegment::where('attendance_day_id', $day->id)->where('source', 'outage')->count())->toBe(1);
});

it('A10 one person dropping while others keep beating is offline', function () {
    $a = makeUser();
    $b = makeUser();
    $c = makeUser();
    foreach ([$a, $b, $c] as $u) {
        at('2026-11-12 10:00');
        signIn($this, $u);
        auth()->logout();
    }
    for ($m = 1; $m <= 16; $m++) {
        foreach ($m <= 10 ? [$a, $b, $c] : [$b, $c] as $u) {
            at(sprintf('2026-11-12 10:%02d', $m));
            $this->actingAs($u)->post(route('heartbeat'));
        }
    }
    at('2026-11-12 10:17');
    $this->actingAs($a)->post(route('heartbeat'));
    $off = TimeSegment::where('attendance_day_id', rowOf($a->employee, '2026-11-12')->id)->where('break_category', 'offline')->sole();
    expect($off->started_at->format('H:i'))->toBe('10:10')->and($off->ended_at->format('H:i'))->toBe('10:17');
});

// ---- A8
it('A8 overtime that crosses midnight continues on the new day', function () {
    $u = makeUser();
    at('2026-11-11 23:30');
    signIn($this, $u);
    beats($this, '2026-11-11 23:31', '2026-11-12 00:05', null);
    at('2026-11-12 00:05');
    app(CloseDay::class)();
    at('2026-11-12 00:06');
    $this->post(route('heartbeat'));

    $today = rowOf($u->employee, '2026-11-12');
    expect(rowOf($u->employee, '2026-11-11')->status)->toBe('ended')
        ->and($today)->not->toBeNull()->and($today->status)->toBe('working');
});

// ---- B1
it('B1 notifies the lead on a new request and the requester on the decision', function () {
    [$lead, $member] = [makeUser('team_lead'), null];
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $day = rowOf($member->employee, '2026-11-11');
    $lead->notifications()->delete();
    $member->notifications()->delete();

    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Sick', 'kind' => 'absent']);
    expect($lead->notifications()->count())->toBe(1)->and($lead->notifications()->first()->data['link'])->toBe('/team/regularizations');

    $req = RegularizationRequest::where('attendance_day_id', $day->id)->firstOrFail();
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'rejected', 'note' => 'No proof']);
    $n = $member->notifications()->latest()->first();
    expect($n->data['title'])->toContain('rejected')->and($n->data['body'])->toContain('No proof');
});

it('B1 sends the new request to HR when the person has no lead', function () {
    $hr = makeUser('hr');
    $member = makeUser();
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $day = rowOf($member->employee, '2026-11-11');
    $hr->notifications()->delete();
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Sick', 'kind' => 'absent']);
    expect($hr->notifications()->count())->toBe(1);
});

// ---- B2
it('B2 deciding an already decided request flashes a message instead of 403', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $day = rowOf($member->employee, '2026-11-11');
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Sick', 'kind' => 'absent']);
    $req = RegularizationRequest::firstOrFail();
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'rejected', 'note' => 'No']);
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'approved'])
        ->assertSessionHas('error', 'This request was already decided.');
});

// ---- B3
it('B3 refuses a regularization for today while the day is still running', function () {
    $u = makeUser();
    at('2026-11-12 12:30');
    app(StartWork::class)($u->employee);
    $day = rowOf($u->employee, '2026-11-12');
    expect($day->late_minutes)->toBeGreaterThan(0);
    $this->actingAs($u)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'x', 'kind' => 'late'])
        ->assertSessionHas('error');
    expect(RegularizationRequest::count())->toBe(0);
});

it('B3 my-day shows the last decision note on a rejected day', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $day = rowOf($member->employee, '2026-11-11');
    $this->actingAs($member)->post(route('attendance.regularizations.store'), ['attendance_day_id' => $day->id, 'reason' => 'Sick', 'kind' => 'absent']);
    $req = RegularizationRequest::firstOrFail();
    $this->actingAs($lead)->post(route('attendance.regularizations.decide'), ['id' => $req->id, 'decision' => 'rejected', 'note' => 'Need a certificate']);
    $this->actingAs($member)->get(route('attendance.my-day'))
        ->assertInertia(fn (Assert $p) => $p->where('recent_days.0.regularization', 'rejected')->where('recent_days.0.last_note', 'Need a certificate'));
});

// ---- B4
it('B4 revoking overtime when approval is not required writes nothing', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    at('2026-11-12 10:00');
    $day = AttendanceDay::create(['employee_id' => $member->employee_id, 'date' => '2026-11-10', 'status' => 'ended', 'work_seconds' => 36000]);
    $this->actingAs($lead)->post(route('attendance.overtime.revoke', $day))->assertSessionHasErrors('minutes');
    expect(RegularizationRequest::count())->toBe(0);
});

// ---- B5
it('B5 a manual break from My day is stored with source manual', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    signIn($this, $u);
    $this->post(route('attendance.break'), ['category' => 'tea']);
    expect(rowOf($u->employee, '2026-11-12')->openSegment()->source)->toBe('manual');
});

// ---- B6
it('B6 a version effective today can be edited and re-grades today\'s ended days', function () {
    $m = makeUser('management');
    $u = makeUser();
    at('2026-11-12 09:00');
    $p = AttendancePolicy::create([...AttendancePolicy::DEFAULTS, 'effective_from' => '2026-11-12']);
    $day = AttendanceDay::create([
        'employee_id' => $u->employee_id, 'date' => '2026-11-12', 'status' => 'ended', 'first_in_at' => '2026-11-12 10:30:00',
        'last_out_at' => '2026-11-12 19:00:00', 'work_seconds' => 30000, 'day_fraction' => 1, 'absence_kind' => 'none', 'late_minutes' => 30,
    ]);
    $this->actingAs($m)->get(route('settings.attendance.index'))
        ->assertInertia(fn (Assert $pg) => $pg->where('versions', fn ($v) => collect($v)->firstWhere('id', $p->id)['editable'] === true));
    $this->actingAs($m)->put(route('settings.attendance.update', $p), [...AttendancePolicy::DEFAULTS, 'shift_start' => '10:10', 'effective_from' => '2026-11-12'])
        ->assertSessionHasNoErrors();
    expect($day->refresh()->late_minutes)->toBe(20);
});

// ---- C1
it('C1 approved leave after the day closed re-grades it as paid leave', function () {
    $u = makeUser();
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    expect(rowOf($u->employee, '2026-11-11'))->absence_kind->toBe('unapproved')->day_fraction->toBe(0.0);

    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    $leave = LeaveRequest::factory()->create(['employee_id' => $u->employee_id, 'leave_type_id' => $type->id, 'starts_on' => '2026-11-10', 'ends_on' => '2026-11-11', 'half_day' => 'none', 'status' => 'approved']);
    $n = app(RegradeDays::class)($u->employee_id, '2026-11-10', '2026-11-11');
    expect($n)->toBeGreaterThanOrEqual(1)
        ->and(rowOf($u->employee, '2026-11-11'))->status->toBe('on_leave')->absence_kind->toBe('paid_leave')->day_fraction->toBe(1.0);

    // cancelling puts it back
    $leave->update(['status' => 'cancelled']);
    app(RegradeDays::class)($u->employee_id, '2026-11-10', '2026-11-11');
    expect(rowOf($u->employee, '2026-11-11'))->status->toBe('absent')->absence_kind->toBe('unapproved')->day_fraction->toBe(0.0);
});

it('C1 creates a missing past row, leaves today and the future alone', function () {
    $u = makeUser();
    at('2026-11-12 10:00');
    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    LeaveRequest::factory()->create(['employee_id' => $u->employee_id, 'leave_type_id' => $type->id, 'starts_on' => '2026-11-09', 'ends_on' => '2026-11-15', 'half_day' => 'none', 'status' => 'approved']);
    app(RegradeDays::class)($u->employee_id, '2026-11-09', '2026-11-15');
    expect(rowOf($u->employee, '2026-11-09'))->status->toBe('on_leave')
        ->and(rowOf($u->employee, '2026-11-12'))->toBeNull()
        ->and(rowOf($u->employee, '2026-11-14'))->toBeNull();
});

it('C1 adding and removing a holiday re-grades closed days for everyone', function () {
    $hr = makeUser('hr');
    $u = makeUser();
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $this->actingAs($hr)->post(route('settings.holidays.store'), ['date' => '2026-11-11', 'name' => 'Late holiday'])->assertSessionHasNoErrors();
    expect(rowOf($u->employee, '2026-11-11'))->status->toBe('holiday')->absence_kind->toBe('holiday')->day_fraction->toBe(1.0);
    $h = Holiday::firstOrFail();
    $this->actingAs($hr)->delete(route('settings.holidays.destroy', $h));
    expect(rowOf($u->employee, '2026-11-11'))->absence_kind->toBe('unapproved')->day_fraction->toBe(0.0);

    $this->actingAs($hr)->post(route('settings.holidays.bulk'), ['lines' => '2026-11-11 Bulk one']);
    expect(rowOf($u->employee, '2026-11-11'))->absence_kind->toBe('holiday');
});

it('C1 booking paid leave through a regularization re-grades the day', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $member = makeUser('employee', ['team_id' => $team->id]);
    at('2026-11-12 00:10');
    app(CloseDay::class)('2026-11-11');
    $day = rowOf($member->employee, '2026-11-11');
    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    LeaveBalance::create(['employee_id' => $member->employee_id, 'leave_type_id' => $type->id, 'year' => 2026, 'entitled' => 10, 'used' => 0, 'pending' => 0]);
    $req = RegularizationRequest::create(['attendance_day_id' => $day->id, 'employee_id' => $member->employee_id, 'reason' => 'x', 'kind' => 'absent', 'status' => 'pending']);
    $ok = app(DecideRegularization::class)($req, 'approved', null, $lead->employee, 'paid_leave', $type->id);
    expect($ok)->toBeTrue()->and($day->refresh())->day_fraction->toBe(1.0)->absence_kind->toBe('paid_leave');
});

it('starts the work week on the first working day after the weekend', function (array $weekend, int $start) {
    expect((new AttendancePolicy(['weekend_days' => $weekend]))->weekStartsOn())->toBe($start);
})->with([
    'Fri+Sat -> Sun' => [[5, 6], 0],
    'Sat+Sun -> Mon' => [[0, 6], 1],
    'Fri only -> Sat' => [[5], 6],
    'none -> Mon' => [[], 1],
]);

it('my day week starts on Monday under a Sat+Sun weekend', function () {
    AttendancePolicy::forDate('2026-11-23')->update(['weekend_days' => [0, 6]]);
    Once::flush();
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 23)->setTime(11, 0)); // Monday
    $this->actingAs($u)->get('/my-day')->assertInertia(fn ($page) => $page
        ->where('week.0.date', '2026-11-23')->where('week.6.date', '2026-11-29')->etc());
});
