<?php

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Reports\AttendanceSheet;
use App\Domain\Reports\DepartmentCost;
use App\Domain\Reports\MonthlySummary;
use App\Domain\Reports\YtdStatement;
use App\Models\AttendanceDay;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\PfLedger;
use App\Models\SalaryStructure;
use App\Models\Team;

function rpItem(PayrollRun $run, Employee $e, array $over = []): PayrollItem
{
    $s = SalaryStructure::firstOrCreate(['employee_id' => $e->id, 'effective_from' => '2024-01-01'], [
        'basic' => 55000, 'house_rent' => 25000, 'medical' => 10000, 'conveyance' => 10000, 'pf_percent' => 0,
        'tax_monthly' => 4000, 'gross' => 100000, 'hourly_rate' => 0,
    ]);

    return PayrollItem::create([
        'run_id' => $run->id, 'employee_id' => $e->id, 'salary_structure_id' => $s->id,
        'gross' => 100000, 'overtime_pay' => 1000, 'unpaid_deduction' => 2000, 'late_deduction' => 500, 'tax' => 4000, 'pf' => 3000,
        'pf_employer' => 3000, 'net' => 90500, ...$over,
    ]);
}

function rpRun(int $y, int $m, string $status = 'paid', string $kind = 'regular'): PayrollRun
{
    return PayrollRun::create(['year' => $y, 'month' => $m, 'status' => $status, 'kind' => $kind]);
}

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 11, 12)->setTime(10, 0));
    $this->hr = makeUser('hr');
    $this->mgmt = makeUser('management');
    $this->deptA = Department::factory()->create(['name' => 'Alpha']);
    $this->deptB = Department::factory()->create(['name' => 'Beta']);
    $this->a1 = makeUser('employee', ['department_id' => $this->deptA->id])->employee;
    $this->a2 = makeUser('employee', ['department_id' => $this->deptA->id])->employee;
    $this->b1 = makeUser('employee', ['department_id' => $this->deptB->id])->employee;
});

it('summarises only approved and paid regular items and skips held and draft', function () {
    $oct = rpRun(2026, 10, 'paid');
    $sep = rpRun(2026, 9, 'approved');
    $draft = rpRun(2026, 8, 'draft');
    $festival = rpRun(2026, 10, 'paid', 'festival');
    $i = rpItem($oct, $this->a1);
    PayrollAdjustment::create(['item_id' => $i->id, 'kind' => 'bonus', 'label' => 'Spot', 'amount' => 5000, 'created_by' => $this->hr->employee_id]);
    PayrollAdjustment::create(['item_id' => $i->id, 'kind' => 'deduction', 'label' => 'Advance', 'amount' => 700, 'created_by' => $this->hr->employee_id]);
    rpItem($oct, $this->b1);
    rpItem($oct, $this->a2, ['hold' => true]);
    rpItem($sep, $this->a1, ['gross' => 50000, 'net' => 40000]);
    rpItem($draft, $this->a1);
    rpItem($festival, $this->a1);

    $months = collect(MonthlySummary::months(12))->keyBy(fn ($m) => $m['year'] * 100 + $m['month']);
    expect($months)->toHaveCount(12)->and($months->first()['label'])->toBe('Dec 2025');
    $o = $months[202610];
    expect($o['headcount'])->toBe(2)->and($o['gross'])->toBe(200000)->and($o['overtime'])->toBe(2000)->and($o['bonus'])->toBe(5000)
        ->and($o['lop'])->toBe(4000)->and($o['late'])->toBe(1000)->and($o['tax'])->toBe(8000)->and($o['pf_employee'])->toBe(6000)
        ->and($o['pf_employer'])->toBe(6000)->and($o['other_deductions'])->toBe(700)->and($o['net'])->toBe(181000)
        ->and($o['employer_cost'])->toBe(200000 + 2000 + 5000 + 6000);
    expect($months[202609]['headcount'])->toBe(1)->and($months[202609]['gross'])->toBe(50000)
        ->and($months[202608]['headcount'])->toBe(0)->and($months[202611]['gross'])->toBe(0);
});

it('groups department cost by employee department', function () {
    $oct = rpRun(2026, 10);
    rpItem($oct, $this->a1);
    rpItem($oct, $this->a2, ['gross' => 60000, 'net' => 50000]);
    rpItem($oct, $this->b1);
    rpItem(rpRun(2026, 9, 'draft'), $this->b1);
    $r = DepartmentCost::for(2026, 10);
    expect($r['rows'])->toHaveCount(2);
    $alpha = collect($r['rows'])->firstWhere('department', 'Alpha');
    $beta = collect($r['rows'])->firstWhere('department', 'Beta');
    expect($alpha['headcount'])->toBe(2)->and($alpha['gross'])->toBe(160000)->and($alpha['net'])->toBe(140500)
        ->and($alpha['employer_cost'])->toBe(160000 + 2000 + 6000)
        ->and($beta['headcount'])->toBe(1)->and($r['total']['gross'])->toBe(260000)->and($r['total']['headcount'])->toBe(3);
    expect(DepartmentCost::for(2026, 9)['rows'])->toBe([]);
});

it('buckets statements by the July to June tax year', function () {
    rpItem(rpRun(2026, 6), $this->a1, ['gross' => 1, 'net' => 1]);
    $jul = rpItem(rpRun(2026, 7), $this->a1, ['gross' => 10, 'net' => 9]);
    rpItem(rpRun(2027, 6), $this->a1, ['gross' => 100, 'net' => 90]);
    rpItem(rpRun(2027, 7), $this->a1, ['gross' => 1000, 'net' => 900]);
    PfLedger::create(['item_id' => $jul->id, 'run_id' => $jul->run_id, 'employee_id' => $this->a1->id, 'year' => 2026, 'month' => 7,
        'employee_amount' => 3000, 'employer_amount' => 3000, 'cumulative_employee' => 9000, 'cumulative_employer' => 9500]);

    $s = YtdStatement::for($this->a1, 2026);
    expect($s['label'])->toBe('2026-27')->and($s['months'])->toHaveCount(12)->and($s['months'][0]['label'])->toBe('Jul 2026')
        ->and($s['months'][11]['label'])->toBe('Jun 2027')->and($s['totals']['gross'])->toBe(110)->and($s['totals']['net'])->toBe(99)
        ->and($s['pf_balance'])->toBe(['employee' => 9000, 'employer' => 9500])->and($s['months'][0]['pf_cumulative_employee'])->toBe(9000);
    expect(YtdStatement::for($this->a1, 2025)['totals']['gross'])->toBe(1)
        ->and(YtdStatement::taxYearOf(2026, 6))->toBe(2025)->and(YtdStatement::taxYearOf(2026, 7))->toBe(2026);
});

it('grades every sheet code including the missing-row fallback', function () {
    $e = $this->a1;
    $e->update(['joined_on' => '2020-01-01']);
    $dates = PayrollPeriod::workingDates(2026, 10);
    [$d1, $d2, $d3, $d4, $d5, $d6, $d7, $d8] = $dates;
    $row = fn ($d, $a) => AttendanceDay::create(['employee_id' => $e->id, 'date' => $d, 'status' => 'ended', 'work_seconds' => 28800, ...$a]);
    $row($d1, ['day_fraction' => 1, 'absence_kind' => 'none', 'late_minutes' => 20]);
    $row($d2, ['day_fraction' => 1, 'absence_kind' => 'excused']);
    $row($d3, ['day_fraction' => 0.5, 'absence_kind' => 'half_day']);
    $row($d4, ['day_fraction' => 0, 'absence_kind' => 'unapproved', 'work_seconds' => 0]);
    $row($d5, ['day_fraction' => 0, 'absence_kind' => 'paid_leave', 'work_seconds' => 0]);
    $row($d6, ['day_fraction' => 0, 'absence_kind' => 'unpaid_leave', 'work_seconds' => 0]);
    // $d7 has no row and no leave -> A ; $d8 has no row but approved paid leave -> L
    $paid = LeaveType::factory()->create(['is_paid' => true]);
    LeaveRequest::create(['employee_id' => $e->id, 'leave_type_id' => $paid->id, 'starts_on' => $d8, 'ends_on' => $d8, 'half_day' => 'none', 'days' => 1, 'reason' => 'x', 'status' => 'approved']);
    Holiday::create(['date' => '2026-10-20', 'name' => 'Holiday']);

    $sheet = AttendanceSheet::for(2026, 10, [$e->id]);
    $cells = $sheet['rows'][0]['cells'];
    $at = fn ($d) => $cells[(int) substr($d, 8, 2) - 1];
    expect($at($d1))->toBe('P')->and($at($d2))->toBe('P')->and($at($d3))->toBe('½')->and($at($d4))->toBe('A')->and($at($d5))->toBe('L')
        ->and($at($d6))->toBe('U')->and($at($d7))->toBe('A')->and($at($d8))->toBe('L')->and($cells[19])->toBe('H');
    $weekend = collect($sheet['days'])->firstWhere('type', 'weekend');
    expect($cells[$weekend['day'] - 1])->toBe('W');
    expect($sheet['rows'][0]['totals'])->toMatchArray(['present' => 2, 'half' => 1, 'late' => 1, 'leave' => 3])
        ->and($sheet['rows'][0]['totals']['absent'])->toBeGreaterThanOrEqual(2);

    $nov = AttendanceSheet::for(2026, 11, [$e->id])['rows'][0]['cells'];
    expect($nov[0])->toBeIn(['A', 'W', 'H'])->and($nov[29])->toBe('-');
    $fut = collect(AttendanceSheet::for(2026, 11, [$e->id])['days'])->firstWhere('date', '2026-11-16');
    expect($nov[$fut['day'] - 1])->toBe('-');
});

it('limits reports to hr and management', function () {
    $this->actingAs(makeUser('employee'))->get('/reports')->assertForbidden();
    $this->actingAs(makeUser('team_lead'))->get('/reports')->assertForbidden();
    $this->actingAs(makeUser('employee'))->get('/reports/payroll-summary.csv')->assertForbidden();
    $this->actingAs($this->hr)->get('/reports')->assertOk();
    $this->actingAs($this->mgmt)->get('/reports?tab=department&month=2026-10')->assertOk();
    $this->actingAs($this->hr)->get('/reports?tab=sheet')->assertOk();
    $this->actingAs($this->hr)->get('/reports?tab=statement&employee='.$this->a1->id)->assertOk();
});

it('serves csv exports', function () {
    $oct = rpRun(2026, 10);
    rpItem($oct, $this->a1);
    $csv = $this->actingAs($this->hr)->get('/reports/payroll-summary.csv')->assertOk()->streamedContent();
    expect($csv)->toContain('Month,Headcount')->and($csv)->toContain('"Oct 2026",1,100000');
    expect($this->actingAs($this->hr)->get('/reports/department-cost.csv?month=2026-10')->streamedContent())->toContain('Total,1,100000');
    expect($this->actingAs($this->hr)->get('/reports/statement.csv?employee='.$this->a1->id.'&tax_year=2026')->streamedContent())->toContain('Total,100000');
    expect($this->actingAs($this->hr)->get('/reports/attendance-sheet.csv?month=2026-10')->streamedContent())->toContain('Code,Employee');
});

it('lets an employee see only their own statement', function () {
    $oct = rpRun(2026, 10);
    rpItem($oct, $this->a1);
    rpItem($oct, $this->b1, ['gross' => 777]);
    $user = $this->a1->user;
    $this->actingAs($user)->get('/me/statement')->assertOk()
        ->assertInertia(fn ($p) => $p->component('Reports/ReportsPage')->where('scope', 'me')->where('statement.employee.id', $this->a1->id)
            ->where('statement.totals.gross', 100000));
    // another employee's id is ignored on /me and refused on the HR route
    $this->actingAs($user)->get('/me/statement?employee='.$this->b1->id)->assertOk()
        ->assertInertia(fn ($p) => $p->where('statement.employee.id', $this->a1->id));
    $this->actingAs($user)->get('/reports?tab=statement&employee='.$this->b1->id)->assertForbidden();
    $this->actingAs($user)->get('/reports/statement.csv?employee='.$this->b1->id)->assertForbidden();
    expect($this->actingAs($user)->get('/me/statement.csv')->streamedContent())->toContain('Total,100000');
});

it('shows a lead only their own team on the sheet', function () {
    $lead = makeUser('team_lead', ['department_id' => $this->deptA->id]);
    $team = Team::factory()->create(['department_id' => $this->deptA->id, 'lead_employee_id' => $lead->employee_id]);
    $lead->employee->update(['team_id' => $team->id]);
    $this->a1->update(['team_id' => $team->id]);

    $this->actingAs($lead)->get('/team/sheet?month=2026-10')->assertOk()
        ->assertInertia(function ($p) use ($lead) {
            $p->component('Reports/ReportsPage')->where('scope', 'team');
            $ids = collect($p->toArray()['props']['sheet']['rows'])->pluck('employee.id')->sort()->values()->all();
            expect($ids)->toBe(collect([$lead->employee_id, $this->a1->id])->sort()->values()->all());
        });
    $this->actingAs($lead)->get('/team/sheet.csv?month=2026-10')->assertOk();
    $this->actingAs(makeUser('employee'))->get('/team/sheet')->assertForbidden();
    $this->actingAs($this->hr)->get('/team/sheet?month=2026-10')->assertOk();
});
