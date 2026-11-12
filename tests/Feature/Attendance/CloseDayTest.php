<?php

use App\Domain\Attendance\Actions\CloseDay;
use App\Domain\Attendance\Actions\StartWork;
use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Team;
use App\Models\TimeSegment;
use Illuminate\Console\Scheduling\Schedule;

// 2026-11-11 is a Wednesday (working day), 2026-11-13 a Friday (weekend).
function dayOf(Employee $e, string $date): ?AttendanceDay
{
    return AttendanceDay::where('employee_id', $e->id)->whereDate('date', $date)->first();
}

it('creates absent rows for people with no attendance and notifies them and their lead', function () {
    $lead = makeUser('team_lead');
    $team = Team::factory()->create(['lead_employee_id' => $lead->employee_id]);
    $u = makeUser('employee', ['team_id' => $team->id]);
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(0, 10));

    app(CloseDay::class)();

    $day = dayOf($u->employee, '2026-11-11');
    expect($day)->status->toBe('absent')->day_fraction->toBe(0.0)->absence_kind->toBe('unapproved')
        ->and($day->closed_at)->not->toBeNull();
    expect($u->notifications()->count())->toBe(1)
        ->and($u->notifications()->first()->data['link'])->toBe('/my-day')
        ->and($lead->notifications()->get()->pluck('data.title')->contains(fn ($t) => str_contains($t, $u->employee->name)))->toBeTrue();
});

it('marks weekend and holiday as paid days without absence', function () {
    $u = makeUser();
    Holiday::create(['date' => '2026-11-11', 'name' => 'Test holiday']);
    app(CloseDay::class)('2026-11-11');
    app(CloseDay::class)('2026-11-13');
    expect(dayOf($u->employee, '2026-11-11'))->status->toBe('holiday')->absence_kind->toBe('holiday')->day_fraction->toBe(1.0)
        ->and(dayOf($u->employee, '2026-11-13'))->status->toBe('holiday')->absence_kind->toBe('weekend')
        ->and($u->notifications()->count())->toBe(0);
});

it('marks approved paid leave as on_leave', function () {
    $u = makeUser();
    $type = LeaveType::factory()->create(['is_paid' => true, 'annual_quota' => 10]);
    LeaveRequest::factory()->create(['employee_id' => $u->employee_id, 'leave_type_id' => $type->id, 'starts_on' => '2026-11-11', 'ends_on' => '2026-11-11', 'half_day' => 'none', 'status' => 'approved']);
    app(CloseDay::class)('2026-11-11');
    expect(dayOf($u->employee, '2026-11-11'))->status->toBe('on_leave')->absence_kind->toBe('paid_leave')->day_fraction->toBe(1.0);
});

it('closes a forgotten working day at shift end and grades it', function () {
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(10, 0));
    app(StartWork::class)($u->employee);
    $u->forceFill(['last_seen_at' => now()->setTime(20, 0)])->save();
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(0, 10));

    app(CloseDay::class)();

    $day = dayOf($u->employee, '2026-11-11');
    expect($day)->status->toBe('ended')->auto_closed->toBeTrue()->work_seconds->toBe(9 * 3600)->day_fraction->toBe(1.0)
        ->and($day->last_out_at->format('H:i'))->toBe('19:00');
    $seg = TimeSegment::where('attendance_day_id', $day->id)->first();
    expect($seg)->source->toBe('manual')->note->toBe('auto-closed')->and($seg->ended_at)->not->toBeNull();
    expect($u->notifications()->first()->data['title'])->toContain('closed automatically');
});

it('closes at the last heartbeat when that is before shift end', function () {
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(10, 0));
    app(StartWork::class)($u->employee);
    $u->forceFill(['last_seen_at' => now()->setTime(13, 0)])->save();
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(0, 10));
    app(CloseDay::class)();
    expect(dayOf($u->employee, '2026-11-11'))->work_seconds->toBe(3 * 3600)->day_fraction->toBe(0.5)->absence_kind->toBe('half_day');
});

it('is idempotent', function () {
    $u = makeUser();
    expect(app(CloseDay::class)('2026-11-11'))->toBe(1);
    $before = dayOf($u->employee, '2026-11-11')->toArray();
    expect(app(CloseDay::class)('2026-11-11'))->toBe(0)
        ->and(AttendanceDay::count())->toBe(1)
        ->and(dayOf($u->employee, '2026-11-11')->toArray())->toBe($before)
        ->and($u->notifications()->count())->toBe(1);
});

it('respects joined_on, exited_on, status and contractors; includes interns', function () {
    $notYet = makeUser('employee', ['joined_on' => '2026-11-12']);
    $left = makeUser('employee', ['exited_on' => '2026-11-10']);
    $lastDay = makeUser('employee', ['exited_on' => '2026-11-11']);
    $contractor = makeUser('employee', ['employment_type' => 'contractor']);
    $intern = makeUser('employee', ['employment_type' => 'intern', 'status' => 'probation']);
    $resigned = makeUser('employee', ['status' => 'resigned']);

    app(CloseDay::class)('2026-11-11');

    expect(dayOf($notYet->employee, '2026-11-11'))->toBeNull()
        ->and(dayOf($left->employee, '2026-11-11'))->toBeNull()
        ->and(dayOf($contractor->employee, '2026-11-11'))->toBeNull()
        ->and(dayOf($resigned->employee, '2026-11-11'))->toBeNull()
        ->and(dayOf($lastDay->employee, '2026-11-11'))->not->toBeNull()
        ->and(dayOf($intern->employee, '2026-11-11'))->not->toBeNull();
});

it('handles a sign-in at 23:59 Dhaka: closes that date, not the next', function () {
    expect(config('app.timezone'))->toBe('Asia/Dhaka');
    $u = makeUser();
    $this->travelTo(now()->setDate(2026, 11, 11)->setTime(23, 59));
    app(StartWork::class)($u->employee);
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(0, 10));

    $this->artisan('attendance:close-day')->assertSuccessful();

    $day = dayOf($u->employee, '2026-11-11');
    expect($day)->status->toBe('ended')->auto_closed->toBeTrue()
        ->and($day->last_out_at->format('Y-m-d H:i'))->toBe('2026-11-11 23:59')
        ->and($day->work_seconds)->toBeLessThanOrEqual(60)
        ->and(dayOf($u->employee, '2026-11-12'))->toBeNull();
});

it('is scheduled at 00:10', function () {
    $events = collect(app(Schedule::class)->events())
        ->filter(fn ($e) => str_contains($e->command, 'attendance:close-day'));
    expect($events)->toHaveCount(1)->and($events->first()->expression)->toBe('10 0 * * *');
});
