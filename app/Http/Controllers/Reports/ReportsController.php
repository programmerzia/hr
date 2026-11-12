<?php

namespace App\Http\Controllers\Reports;

use App\Domain\Attendance\Services\Scope;
use App\Domain\Reports\AttendanceSheet;
use App\Domain\Reports\DepartmentCost;
use App\Domain\Reports\MonthlySummary;
use App\Domain\Reports\YtdStatement;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    private const TABS = ['summary', 'department', 'statement', 'sheet'];

    public function index(Request $request): Response
    {
        $f = $this->filters($request);
        $props = ['scope' => 'all', 'filters' => $f, 'summary' => null, 'department' => null, 'statement' => null, 'sheet' => null];
        $props += ['employees' => [], 'departments' => [], 'teams' => [], 'tax_years' => []];

        match ($f['tab']) {
            'summary' => $props['summary'] = MonthlySummary::months(12),
            'department' => $props['department'] = DepartmentCost::for($f['year'], $f['month']),
            'statement' => $props += $this->statementProps($f),
            default => $props['sheet'] = $this->sheet($request, $f),
        };
        if ($f['tab'] === 'statement') {
            $props['employees'] = Employee::orderBy('name')->get(['id', 'name', 'code'])->all();
        }
        if ($f['tab'] === 'sheet') {
            $props['departments'] = Department::orderBy('name')->get(['id', 'name'])->all();
            $props['teams'] = Team::orderBy('name')->get(['id', 'name'])->all();
        }

        return Inertia::render('Reports/ReportsPage', $props);
    }

    public function teamSheet(Request $request): Response
    {
        $f = $this->filters($request);
        $f['tab'] = 'sheet';

        return Inertia::render('Reports/ReportsPage', [
            'scope' => 'team', 'filters' => $f, 'summary' => null, 'department' => null, 'statement' => null,
            'sheet' => $this->sheet($request, $f), 'employees' => [], 'departments' => [], 'tax_years' => [],
            'teams' => $request->user()->role === 'team_lead' ? [] : Team::orderBy('name')->get(['id', 'name'])->all(),
        ]);
    }

    public function myStatement(Request $request): Response
    {
        $employee = $request->user()->employee;
        abort_unless($employee, 404);
        $year = $this->taxYear($request, $employee);

        return Inertia::render('Reports/ReportsPage', [
            'scope' => 'me', 'filters' => [...$this->filters($request), 'tab' => 'statement', 'tax_year' => $year],
            'summary' => null, 'department' => null, 'sheet' => null, 'employees' => [], 'departments' => [], 'teams' => [],
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

    /** @return array{tab:string,year:int,month:int,tax_year:int|null,employee:string|null,department:string,team:string,q:string} */
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
        ]);
        $m = CarbonImmutable::parse(($v['month'] ?? now()->format('Y-m')).'-01');

        return [
            'tab' => $v['tab'] ?? 'summary', 'year' => $m->year, 'month' => $m->month,
            'tax_year' => isset($v['tax_year']) ? (int) $v['tax_year'] : null,
            'employee' => $v['employee'] ?? null, 'department' => $v['department'] ?? 'all', 'team' => $v['team'] ?? 'all',
            'q' => trim($v['q'] ?? ''),
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
        $ids = Scope::employees($request->user());
        if ($request->routeIs('reports.*')) {
            // HR / management: include everyone, even people who left during the month.
            $ids = Employee::query();
        }
        $ids = $ids
            ->when($f['department'] !== 'all', fn ($q) => $q->where('department_id', $f['department']))
            ->when($f['team'] !== 'all', fn ($q) => $q->where('team_id', $f['team']))
            ->when($f['q'] !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($f['q'], '%_\\').'%'))
            ->where('joined_on', '<=', CarbonImmutable::create($f['year'], $f['month'], 1)->endOfMonth()->toDateString())
            ->where(fn ($q) => $q->whereNull('exited_on')->orWhere('exited_on', '>=', sprintf('%04d-%02d-01', $f['year'], $f['month'])))
            ->pluck('id')->all();

        return AttendanceSheet::for($f['year'], $f['month'], $ids);
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
            fputcsv($out, $head);
            foreach ($rows as $r) {
                fputcsv($out, $r);
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
