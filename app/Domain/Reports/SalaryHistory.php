<?php

namespace App\Domain\Reports;

use App\Models\Employee;
use App\Models\SalaryStructure;

/** Every salary structure with the gross it replaced. The range filters on the effective date; the previous gross is always the true predecessor. */
final class SalaryHistory
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(?string $from, ?string $to, array $ids): array
    {
        $emps = Employee::whereIn('id', $ids)->get()->keyBy('id');
        $rows = [];
        foreach (SalaryStructure::whereIn('employee_id', $ids)->orderBy('effective_from')->orderBy('created_at')->get()->groupBy('employee_id') as $eid => $list) {
            $prev = null;
            foreach ($list as $s) {
                $date = $s->effective_from->format('Y-m-d');
                $inRange = (! $from || $date >= $from) && (! $to || $date <= $to);
                if ($inRange) {
                    $gross = (int) $s->gross;
                    $rows[] = [
                        'code' => $emps[$eid]->code, 'name' => $emps[$eid]->name, 'effective' => $date,
                        'previous' => $prev, 'gross' => $gross,
                        'change' => $prev === null ? null : $gross - $prev,
                        'pct' => $prev ? round(($gross - $prev) / $prev * 100, 1) : null,
                        'note' => (string) ($s->note ?? ''),
                    ];
                }
                $prev = (int) $s->gross;
            }
        }
        usort($rows, fn ($a, $b) => [$b['effective'], $a['name']] <=> [$a['effective'], $b['name']]);

        return Table::make([
            ['code', 'Code'], ['name', 'Employee'], ['effective', 'Effective', 'date'], ['previous', 'Previous gross', 'money'],
            ['gross', 'New gross', 'money'], ['change', 'Change', 'money'], ['pct', 'Change %', 'pct'], ['note', 'Note'],
        ], $rows);
    }
}
