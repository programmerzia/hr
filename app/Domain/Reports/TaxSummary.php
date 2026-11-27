<?php

namespace App\Domain\Reports;

use App\Models\Department;
use App\Models\Employee;

/** Tax deducted at source per employee for one month, from approved or paid regular payroll (the NBR challan figures). */
final class TaxSummary
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(int $year, int $month, array $ids): array
    {
        $items = PaidItems::rows(PaidItems::query()->where('payroll_runs.year', $year)->where('payroll_runs.month', $month)->whereIn('payroll_items.employee_id', $ids));
        $emps = Employee::whereIn('id', $items->pluck('employee_id'))->get()->keyBy('id');
        $depts = Department::pluck('name', 'id');
        $rows = $items->map(fn ($i) => [
            'code' => $emps[$i['employee_id']]->code, 'name' => $emps[$i['employee_id']]->name,
            'department' => $depts[$emps[$i['employee_id']]->department_id] ?? '', 'nid' => $emps[$i['employee_id']]->nid,
            'gross' => $i['gross'] + $i['overtime'] + $i['bonus'], 'tax' => $i['tax'],
        ])->sortBy('name')->values()->all();

        return Table::make([
            ['code', 'Code'], ['name', 'Employee'], ['department', 'Department'], ['nid', 'NID'], ['gross', 'Taxable pay (gross + overtime + bonus)', 'money'], ['tax', 'Tax deducted', 'money'],
        ], $rows, ['code' => '', 'name' => 'Total', 'gross' => array_sum(array_column($rows, 'gross')), 'tax' => array_sum(array_column($rows, 'tax'))], null, ['label' => \Carbon\CarbonImmutable::create($year, $month, 1)->format('F Y')]);
    }
}
