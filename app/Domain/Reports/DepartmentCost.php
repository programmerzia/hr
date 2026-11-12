<?php

namespace App\Domain\Reports;

use App\Models\Department;
use App\Models\Employee;

/** Paid / approved items of one month grouped by the employee's current department. */
final class DepartmentCost
{
    /** @return array{rows:list<array<string,mixed>>,total:array<string,int>} */
    public static function for(int $year, int $month): array
    {
        $rows = PaidItems::rows(PaidItems::query()->where('payroll_runs.year', $year)->where('payroll_runs.month', $month));
        $dept = Employee::whereIn('id', $rows->pluck('employee_id'))->pluck('department_id', 'id');
        $names = Department::pluck('name', 'id');

        $groups = $rows->groupBy(fn ($r) => $dept[$r['employee_id']] ?? '');
        $out = [];
        foreach ($groups as $id => $g) {
            $out[] = [
                'department_id' => $id ?: null,
                'department' => $id ? ($names[$id] ?? 'Unknown') : 'No department',
                'headcount' => $g->count(),
                ...PaidItems::sum($g),
            ];
        }
        usort($out, fn ($a, $b) => $b['employer_cost'] <=> $a['employer_cost'] ?: strcmp($a['department'], $b['department']));

        return ['rows' => $out, 'total' => ['headcount' => $rows->count(), ...PaidItems::sum($rows)]];
    }
}
