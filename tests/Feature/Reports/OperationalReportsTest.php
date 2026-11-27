<?php

use App\Models\AttendanceDay;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;
use App\Models\Team;
use App\Models\TimeSegment;

function orDay(Employee $e, string $date, array $over = []): AttendanceDay
{
    return AttendanceDay::create([
        'employee_id' => $e->id, 'date' => $date, 'status' => 'ended', 'first_in_at' => "$date 04:00:00", 'last_out_at' => "$date 13:00:00",
        'work_seconds' => 28800, 'break_seconds' => 3600, 'day_fraction' => 1, 'absence_kind' => 'none', ...$over,
    ]);
}

function orGet($test, string $tab, array $q = [])
{
    return $test->get(route('reports.index', ['tab' => $tab, ...$q]));
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0)); // Thursday
    $this->hr = makeUser('hr');
    $this->dept = Department::factory()->create(['name' => 'Alpha']);
    $this->e1 = makeUser('employee', ['department_id' => $this->dept->id, 'name' => 'Aisha Rahman', 'joined_on' => '2025-01-01'])->employee;
    $this->e2 = makeUser('employee', ['department_id' => $this->dept->id, 'name' => 'Bashir Khan', 'joined_on' => '2026-11-03'])->employee;
});

it('summarises a month of attendance per employee', function () {
    $d = orDay($this->e1, '2026-11-02', ['late_minutes' => 20, 'is_regularized' => false]);
    orDay($this->e1, '2026-11-03', ['late_minutes' => 10, 'early_minutes' => 30, 'is_regularized' => true]);
    orDay($this->e1, '2026-11-04', ['day_fraction' => 0.5, 'absence_kind' => 'half_day']);
    TimeSegment::create(['attendance_day_id' => $d->id, 'type' => 'break', 'break_category' => 'lunch', 'started_at' => '2026-11-02 07:00:00', 'ended_at' => '2026-11-02 08:00:00']);
    TimeSegment::create(['attendance_day_id' => $d->id, 'type' => 'break', 'break_category' => 'offline', 'started_at' => '2026-11-02 09:00:00', 'ended_at' => '2026-11-02 09:30:00']);

    $res = orGet($this->actingAs($this->hr), 'att_summary', ['month' => '2026-11', 'q' => 'Aisha'])->assertOk();
    $row = $res->viewData('page')['props']['report']['rows'][0];

    expect($row['name'])->toBe('Aisha Rahman')
        ->and($row['present'])->toBe(2)->and($row['half'])->toBe(1)
        ->and($row['late'])->toBe(1)->and($row['late_minutes'])->toBe(20)
        ->and($row['early'])->toBe(0)->and($row['regularized'])->toBe(1)
        ->and($row['work_hours'])->toBe(24.0)->and($row['break_hours'])->toBe(1.0)->and($row['offline_hours'])->toBe(0.5);
});

it('lists a single date and who is in now', function () {
    $d = orDay($this->e1, '2026-11-12', ['status' => 'working', 'last_out_at' => null, 'work_seconds' => 3600]);
    $res = orGet($this->actingAs($this->hr), 'att_daily', ['date' => '2026-11-12'])->assertOk();
    $report = $res->viewData('page')['props']['report'];
    $rows = collect($report['rows'])->keyBy('name');

    expect($rows['Aisha Rahman']['status'])->toBe('Working')->and($rows['Aisha Rahman']['work_hours'])->toBe(1.0)
        ->and($rows['Bashir Khan']['status'])->toBe('Not in yet')
        ->and($report['extra']['in_now'])->toHaveCount(1);
});

it('reports late and early instances with per-person totals', function () {
    orDay($this->e1, '2026-11-02', ['late_minutes' => 20, 'early_minutes' => 15]);
    orDay($this->e1, '2026-11-03', ['late_minutes' => 5, 'is_regularized' => true]);

    $report = orGet($this->actingAs($this->hr), 'late_early', ['from' => '2026-11-01', 'to' => '2026-11-12'])->assertOk()->viewData('page')['props']['report'];

    expect($report['rows'])->toHaveCount(3)
        ->and(collect($report['rows'])->where('regularized', 'Yes')->count())->toBe(1)
        ->and($report['secondary']['rows'][0])->toMatchArray(['late' => 1, 'late_min' => 20, 'early' => 1, 'early_min' => 15]);
});

it('registers leave requests with approver decisions', function () {
    $type = LeaveType::create(['name' => 'Casual', 'annual_quota' => 10, 'is_paid' => true]);
    $r = LeaveRequest::create(['employee_id' => $this->e1->id, 'leave_type_id' => $type->id, 'starts_on' => '2026-11-09', 'ends_on' => '2026-11-10', 'days' => 2, 'reason' => 'x', 'status' => 'approved']);
    LeaveApproval::create(['leave_request_id' => $r->id, 'stage' => 'lead', 'decided_by' => $this->hr->employee_id, 'decision' => 'approved', 'decided_at' => '2026-11-08 06:00:00']);

    $row = orGet($this->actingAs($this->hr), 'leave_register', ['from' => '2026-11-01', 'to' => '2026-11-30'])->assertOk()->viewData('page')['props']['report']['rows'][0];

    expect($row)->toMatchArray(['name' => 'Aisha Rahman', 'type' => 'Casual', 'paid' => 'Paid', 'days' => 2.0, 'status' => 'approved'])
        ->and($row['lead'])->toContain('approved');
});

it('shows leave balances per type', function () {
    $type = LeaveType::create(['name' => 'Casual', 'annual_quota' => 10, 'is_paid' => true]);
    LeaveBalance::updateOrCreate(['employee_id' => $this->e1->id, 'leave_type_id' => $type->id, 'year' => 2026], ['entitled' => 10, 'used' => 3, 'pending' => 1, 'carried_in' => 2]);

    $rows = collect(orGet($this->actingAs($this->hr), 'leave_balance', ['asof' => '2026-11-12', 'q' => 'Aisha'])->assertOk()->viewData('page')['props']['report']['rows']);
    $row = $rows->firstWhere('type', 'Casual');

    expect($row)->toMatchArray(['entitled' => 10.0, 'carried' => 2.0, 'taken' => 3.0, 'pending' => 1.0, 'balance' => 8.0]);
});

it('counts headcount, joiners and leavers', function () {
    $this->e1->update(['exited_on' => '2026-11-10']);
    $rows = orGet($this->actingAs($this->hr), 'headcount', ['from' => '2026-11-01', 'to' => '2026-11-30'])->assertOk()->viewData('page')['props']['report'];
    $alpha = collect($rows['rows'])->firstWhere('department', 'Alpha');

    expect($alpha)->toMatchArray(['active' => 1, 'joiners' => 1, 'leavers' => 1])
        ->and(collect($rows['secondary']['rows'])->pluck('event')->sort()->values()->all())->toBe(['Joined', 'Left']);
});

it('shows salary changes and the monthly tax summary to payroll staff only', function () {
    $mk = fn ($from, $gross) => SalaryStructure::create(['employee_id' => $this->e1->id, 'effective_from' => $from, 'gross' => $gross, 'basic' => $gross]);
    $mk('2025-01-01', 100000);
    $s2 = $mk('2026-07-01', 110000);
    $run = PayrollRun::create(['year' => 2026, 'month' => 10, 'status' => 'paid', 'kind' => 'regular']);
    PayrollItem::create(['run_id' => $run->id, 'employee_id' => $this->e1->id, 'salary_structure_id' => $s2->id, 'gross' => 110000, 'overtime_pay' => 0, 'tax' => 4500, 'pf' => 0, 'net' => 105500]);

    $this->actingAs($this->hr);
    $hist = orGet($this, 'salary_history')->assertOk()->viewData('page')['props']['report']['rows'];
    expect($hist[0])->toMatchArray(['previous' => 100000, 'gross' => 110000, 'change' => 10000, 'pct' => 10.0]);

    $tds = orGet($this, 'tds', ['month' => '2026-10'])->assertOk()->viewData('page')['props']['report'];
    expect($tds['rows'][0]['tax'])->toBe(4500)->and($tds['totals']['tax'])->toBe(4500);

    $viewer = makeUser('employee');
    $viewer->givePermissionTo('view_reports');
    $this->actingAs($viewer);
    orGet($this, 'att_summary')->assertOk();
    orGet($this, 'salary_history')->assertForbidden();
    orGet($this, 'tds')->assertForbidden();
    $this->get(route('reports.export', 'tds'))->assertForbidden();
});

it('exports csv with a BOM and all rows', function () {
    orDay($this->e1, '2026-11-02', ['late_minutes' => 20]);
    $res = $this->actingAs($this->hr)->get(route('reports.export', ['report' => 'late_early', 'from' => '2026-11-01', 'to' => '2026-11-12']))->assertOk();
    $body = $res->streamedContent();

    expect(str_starts_with($body, "\xEF\xBB\xBF"))->toBeTrue()->and($body)->toContain('Aisha Rahman');
});

it('lets a team lead run attendance reports for their own team only', function () {
    $lead = makeUser('team_lead', ['department_id' => $this->dept->id]);
    $team = Team::factory()->create(['department_id' => $this->dept->id, 'lead_employee_id' => $lead->employee_id]);
    $this->e1->update(['team_id' => $team->id]);
    $this->e2->update(['team_id' => Team::factory()->create(['department_id' => $this->dept->id])->id]);
    orDay($this->e1, '2026-11-02');

    $this->actingAs($lead);
    $rows = $this->get(route('team.sheet', ['tab' => 'att_summary', 'month' => '2026-11']))->assertOk()->viewData('page')['props']['report']['rows'];
    expect(collect($rows)->pluck('name')->all())->toContain('Aisha Rahman')->not->toContain('Bashir Khan');
    $this->get(route('team.sheet', ['tab' => 'tds']))->assertOk()->viewData('page')['props']['sheet']; // falls back to the sheet
    $this->get(route('team.export', 'headcount'))->assertNotFound();
    $this->get(route('reports.index'))->assertForbidden();
});

it('renders the in-app error page in production-like envs only', function () {
    config(['app.debug' => false]);
    $this->actingAs($this->hr)->get('/no-such-page')->assertNotFound()
        ->assertInertia(fn ($p) => $p->component('Errors/Error')->where('status', 404));

    config(['app.debug' => true]);
    $res = $this->actingAs($this->hr)->get('/no-such-page')->assertNotFound();
    expect($res->getContent())->not->toContain('Errors\\/Error')->not->toContain('Errors/Error');
});
