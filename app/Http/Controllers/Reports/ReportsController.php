<?php

namespace App\Http\Controllers\Reports;

use App\Domain\Attendance\Services\Scope;
use App\Domain\Reports\AttendanceSheet;
use App\Domain\Reports\AttendanceSummary;
use App\Domain\Reports\DailyAttendance;
use App\Domain\Reports\Headcount;
use App\Domain\Reports\LateEarly;
use App\Domain\Reports\LeaveBalances;
use App\Domain\Reports\LeaveRegister;
use App\Domain\Reports\SalaryHistory;
use App\Domain\Reports\TaxSummary;
use App\Domain\Reports\DepartmentCost;
use App\Domain\Reports\MonthlySummary;
use App\Domain\Reports\YtdStatement;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    private const REPORT_TABS = ['att_summary', 'att_daily', 'late_early', 'leave_register', 'leave_balance', 'headcount', 'salary_history', 'tds'];

    private const TABS = ['summary', 'department', 'statement', 'sheet', ...self::REPORT_TABS];

    /** Attendance and leave reports a team lead may run for the people they lead. */
    private const TEAM_TABS = ['sheet', 'att_summary', 'att_daily', 'late_early', 'leave_register', 'leave_balance'];

    private const PAYROLL_TABS = ['salary_history', 'tds'];

    private const PER_PAGE = 50;

    public function index(Request $request): Response
    {
        $f = $this->filters($request);
        $props = ['scope' => 'all', 'filters' => $f, 'summary' => null, 'department' => null, 'statement' => null, 'sheet' => null];
        $props += ['employees' => [], 'departments' => [], 'teams' => [], 'tax_years' => [], 'report' => null, 'meta' => null];
        $props['can_payroll'] = $request->user()->can('payroll_staff');
        $this->authorizeTab($request, $f['tab'], false);

        match ($f['tab']) {
            'summary' => $props['summary'] = MonthlySummary::months(12),
            'department' => $props['department'] = DepartmentCost::for($f['year'], $f['month']),
            'statement' => $props += $this->statementProps($f),
            'sheet' => $props['sheet'] = $this->sheet($request, $f),
            default => [$props['report'], $props['meta']] = $this->paged($this->table($request, $f, false)),
        };
        if ($f['tab'] === 'statement') {
            $props['employees'] = Employee::orderBy('name')->get(['id', 'name', 'code'])->all();
        }
        if (! in_array($f['tab'], ['summary', 'department', 'statement'], true)) {
            $props['departments'] = Department::orderBy('name')->get(['id', 'name'])->all();
            $props['teams'] = Team::orderBy('name')->get(['id', 'name'])->all();
        }

        return Inertia::render('Reports/ReportsPage', $props);
    }

    public function teamSheet(Request $request): Response
    {
        $f = $this->filters($request);
        $f['tab'] = in_array($request->query('tab'), self::TEAM_TABS, true) ? $request->query('tab') : 'sheet';
        $props = [
            'scope' => 'team', 'filters' => $f, 'summary' => null, 'department' => null, 'statement' => null, 'sheet' => null,
            'employees' => [], 'departments' => [], 'tax_years' => [], 'report' => null, 'meta' => null, 'can_payroll' => false,
            'teams' => $request->user()->checkPermissionTo('view_company') ? Team::orderBy('name')->get(['id', 'name'])->all() : [],
        ];
        if ($f['tab'] === 'sheet') {
            $props['sheet'] = $this->sheet($request, $f);
        } else {
            [$props['report'], $props['meta']] = $this->paged($this->table($request, $f, true));
        }

        return Inertia::render('Reports/ReportsPage', $props);
    }

    /** CSV of any tabular report: every row, UTF-8 with BOM. */
    public function export(Request $request, string $report): StreamedResponse
    {
        abort_unless(in_array($report, self::REPORT_TABS, true), 404);

        return $this->tableDownload($request, $report, false);
    }

    public function teamExport(Request $request, string $report): StreamedResponse
    {
        abort_unless(in_array($report, self::TEAM_TABS, true) && $report !== 'sheet', 404);

        return $this->tableDownload($request, $report, true);
    }

    public function myStatement(Request $request): Response
    {
        $employee = $request->user()->employee;
        abort_unless($employee, 404);
        $year = $this->taxYear($request, $employee);

        return Inertia::render('Reports/ReportsPage', [
            'scope' => 'me', 'filters' => [...$this->filters($request), 'tab' => 'statement', 'tax_year' => $year],
            'summary' => null, 'department' => null, 'sheet' => null, 'employees' => [], 'departments' => [], 'teams' => [],
            'report' => null, 'meta' => null, 'can_payroll' => false,
            'statement' => YtdStatement::for($employee, $year), 'tax_years' => YtdStatement::yearsFor($employee),
        ]);
    }

    public function summaryCsv(): StreamedResponse
    {
        $head = ['Month', 'Headcount', 'Gross', 'Overtime', 'Bonus', 'LOP', 'Late deduction', 'Tax', 'PF employee', 'PF employer', 'Other deductions', 'Net', 'Employer cost'];

        return $this->csv('payroll-summary.csv', $head, array_map(fn ($m) => [
            $m['label'], $m['headcount'], $m['gross'], $m['overtime'], $m['bonus'], $m['lop'], $m['late'], $m['tax'],
            $m['pf_employee'], $m['pf_employer'], $m['other_deductions'], $m['net'], $m['employer_cost'],
        ], MonthlySummary::months(12)));
    }

    public function departmentCsv(Request $request): StreamedResponse
    {
        $f = $this->filters($request);
        $d = DepartmentCost::for($f['year'], $f['month']);
        $rows = array_map(fn ($r) => [$r['department'], $r['headcount'], $r['gross'], $r['employer_cost'], $r['net']], $d['rows']);
        $rows[] = ['Total', $d['total']['headcount'], $d['total']['gross'], $d['total']['employer_cost'], $d['total']['net']];

        return $this->csv(sprintf('department-cost-%04d-%02d.csv', $f['year'], $f['month']), ['Department', 'Headcount', 'Gross', 'Employer cost', 'Net'], $rows);
    }

    public function statementCsv(Request $request): StreamedResponse
    {
        $employee = Employee::findOrFail($request->validate(['employee' => ['required', 'string']])['employee']);

        return $this->statementDownload($employee, $this->taxYear($request, $employee));
    }

    public function myStatementCsv(Request $request): StreamedResponse
    {
        $employee = $request->user()->employee;
        abort_unless($employee, 404);

        return $this->statementDownload($employee, $this->taxYear($request, $employee));
    }

    public function sheetCsv(Request $request): StreamedResponse
    {
        $f = $this->filters($request);

        return $this->sheetDownload($this->sheet($request, $f));
    }

    public function teamSheetCsv(Request $request): StreamedResponse
    {
        return $this->sheetDownload($this->sheet($request, $this->filters($request)));
    }

    /** @return array<string,mixed> */
    private function filters(Request $request): array
    {
        $v = $request->validate([
            'tab' => ['nullable', 'in:'.implode(',', self::TABS)],
            'month' => ['nullable', 'date_format:Y-m'],
            'tax_year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'employee' => ['nullable', 'string'],
            'department' => ['nullable', 'string'],
            'team' => ['nullable', 'string'],
            'q' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'asof' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $today = now()->toDateString();
        $m = CarbonImmutable::parse(($v['month'] ?? now()->format('Y-m')).'-01');

        return [
            'tab' => $v['tab'] ?? 'summary', 'year' => $m->year, 'month' => $m->month,
            'tax_year' => isset($v['tax_year']) ? (int) $v['tax_year'] : null,
            'employee' => $v['employee'] ?? null, 'department' => $v['department'] ?? 'all', 'team' => $v['team'] ?? 'all',
            'q' => trim($v['q'] ?? ''),
            'from' => $v['from'] ?? null, 'to' => $v['to'] ?? null,
            'date' => $v['date'] ?? $today, 'asof' => $v['asof'] ?? $today, 'page' => (int) ($v['page'] ?? 1),
        ];
    }

    private function taxYear(Request $request, Employee $employee): int
    {
        $v = $request->validate(['tax_year' => ['nullable', 'integer', 'min:2000', 'max:2100']]);
        $now = now();

        return (int) ($v['tax_year'] ?? YtdStatement::taxYearOf($now->year, $now->month));
    }

    /** @return array<string,mixed> */
    private function statementProps(array $f): array
    {
        $employee = $f['employee'] ? Employee::find($f['employee']) : null;
        $year = $f['tax_year'] ?? YtdStatement::taxYearOf(now()->year, now()->month);

        return [
            'statement' => $employee ? YtdStatement::for($employee, $year) : null,
            'tax_years' => $employee ? YtdStatement::yearsFor($employee) : [$year],
        ];
    }

    /** @return array<string,mixed> */
    private function sheet(Request $request, array $f): array
    {
        $team = ! $request->routeIs('reports.*');
        $first = sprintf('%04d-%02d-01', $f['year'], $f['month']);

        return AttendanceSheet::for($f['year'], $f['month'], $this->ids($request, $f, $team, $first, CarbonImmutable::parse($first)->endOfMonth()->toDateString()));
    }

    /**
     * Employee ids the viewer may report on, narrowed by the filters and (optionally) employed at some point in the window.
     * Company reports include people who left in the window; team reports use the Scope helper (people still employed).
     *
     * @return list<string>
     */
    private function ids(Request $request, array $f, bool $team, ?string $from, ?string $to): array
    {
        $q = $team ? Scope::employees($request->user()) : Employee::query();

        return $q
            ->when($f['department'] !== 'all', fn ($q) => $q->where('department_id', $f['department']))
            ->when($f['team'] !== 'all', fn ($q) => $q->where('team_id', $f['team']))
            ->when($f['q'] !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($f['q'], '%_\\').'%'))
            ->when($to, fn ($q) => $q->where('joined_on', '<=', $to))
            ->when($from, fn ($q) => $q->where(fn ($w) => $w->whereNull('exited_on')->orWhere('exited_on', '>=', $from)))
            ->pluck('id')->all();
    }

    private function authorizeTab(Request $request, string $tab, bool $team): void
    {
        if (in_array($tab, self::PAYROLL_TABS, true)) {
            abort_unless(! $team && Gate::forUser($request->user())->allows('payroll_staff'), 403);
        }
    }

    /** @return array<string,mixed> the full (unpaged) table of a tabular report */
    private function table(Request $request, array $f, bool $team): array
    {
        $this->authorizeTab($request, $f['tab'], $team);
        [$from, $to] = $this->range($f);
        $monthFirst = sprintf('%04d-%02d-01', $f['year'], $f['month']);
        $monthLast = CarbonImmutable::parse($monthFirst)->endOfMonth()->toDateString();

        return match ($f['tab']) {
            'att_summary' => AttendanceSummary::for($f['year'], $f['month'], $this->ids($request, $f, $team, $monthFirst, $monthLast)),
            'att_daily' => DailyAttendance::for($f['date'], $this->ids($request, $f, $team, $f['date'], $f['date'])),
            'late_early' => LateEarly::for($from, $to, $this->ids($request, $f, $team, $from, $to)),
            'leave_register' => LeaveRegister::for($from, $to, $this->ids($request, $f, $team, null, null)),
            'leave_balance' => LeaveBalances::for($f['asof'], $this->ids($request, $f, $team, $f['asof'], $f['asof'])),
            'headcount' => Headcount::for($from, $to, $f['department'] === 'all' ? null : $f['department']),
            'salary_history' => SalaryHistory::for($f['from'], $f['to'], $this->ids($request, $f, false, null, null)),
            'tds' => TaxSummary::for($f['year'], $f['month'], $this->ids($request, $f, false, null, null)),
        };
    }

    /** Resolved date range of the range reports (this month so far by default). @return array{0:string,1:string} */
    private function range(array $f): array
    {
        $to = $f['to'] ?? now()->toDateString();

        return [$f['from'] ?? CarbonImmutable::parse($to)->startOfMonth()->toDateString(), $to];
    }

    /** @return array{0:array<string,mixed>,1:array{total:int,page:int,per:int,from:string|null,to:string|null}} */
    private function paged(array $table): array
    {
        $page = max(1, (int) request()->query('page', 1));
        $total = count($table['rows']);
        $table['rows'] = array_slice($table['rows'], ($page - 1) * self::PER_PAGE, self::PER_PAGE);
        if (! empty($table['secondary']) && count($table['secondary']['rows']) > 200) {
            $table['secondary']['rows'] = array_slice($table['secondary']['rows'], 0, 200);
        }

        return [$table, ['total' => $total, 'page' => $page, 'per' => self::PER_PAGE, 'range' => $this->range(['from' => request()->query('from'), 'to' => request()->query('to')])]];
    }

    private function tableDownload(Request $request, string $report, bool $team): StreamedResponse
    {
        $f = $this->filters($request);
        $f['tab'] = $report;
        $t = $this->table($request, $f, $team);
        $head = array_column($t['columns'], 'label');
        $cell = fn ($row, $c) => $row[$c['key']] ?? '';
        $rows = array_map(fn ($r) => array_map(fn ($c) => $cell($r, $c), $t['columns']), $t['rows']);
        if ($t['totals']) {
            $rows[] = array_map(fn ($c) => $cell($t['totals'], $c), $t['columns']);
        }
        if (! empty($t['secondary'])) {
            $rows[] = [];
            $rows[] = [$t['secondary']['title']];
            $rows[] = array_column($t['secondary']['columns'], 'label');
            foreach ($t['secondary']['rows'] as $r) {
                $rows[] = array_map(fn ($c) => $cell($r, $c), $t['secondary']['columns']);
            }
        }
        $stamp = $f['tab'] === 'att_daily' ? $f['date'] : sprintf('%04d-%02d', $f['year'], $f['month']);

        return $this->csv(str_replace('_', '-', $report)."-{$stamp}.csv", $head, $rows);
    }

    private function sheetDownload(array $sheet): StreamedResponse
    {
        $head = ['Code', 'Employee', 'Department', 'Team', ...array_column($sheet['days'], 'day'), 'Present', 'Half', 'Absent', 'Leave', 'Late'];
        $rows = array_map(fn ($r) => [
            $r['employee']['code'], $r['employee']['name'], $r['employee']['department'] ?? '', $r['employee']['team'] ?? '',
            ...array_map(fn ($c) => $c === '-' ? '-' : $c, $r['cells']),
            $r['totals']['present'], $r['totals']['half'], $r['totals']['absent'], $r['totals']['leave'], $r['totals']['late'],
        ], $sheet['rows']);

        return $this->csv(sprintf('attendance-sheet-%04d-%02d.csv', $sheet['year'], $sheet['month']), $head, $rows);
    }

    private function statementDownload(Employee $employee, int $year): StreamedResponse
    {
        $s = YtdStatement::for($employee, $year);
        $keys = ['gross', 'overtime', 'bonus', 'lop', 'late', 'tax', 'pf_employee', 'pf_employer', 'net'];
        $rows = array_map(fn ($m) => [$m['label'], ...array_map(fn ($k) => $m[$k], $keys)], $s['months']);
        $rows[] = ['Total', ...array_map(fn ($k) => $s['totals'][$k], $keys)];

        return $this->csv("statement-{$employee->code}-{$s['label']}.csv", ['Month', 'Gross', 'Overtime', 'Bonus', 'LOP', 'Late deduction', 'Tax', 'PF employee', 'PF employer', 'Net'], $rows);
    }

    /** @param list<string> $head @param array<int,array<int,mixed>> $rows */
    private function csv(string $name, array $head, array $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($head, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $head);
            foreach ($rows as $r) {
                fputcsv($out, $r);
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
