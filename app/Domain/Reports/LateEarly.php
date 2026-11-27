<?php

namespace App\Domain\Reports;

use App\Models\AttendanceDay;
use App\Models\Employee;

/** Every late and early-leave instance in a date range, plus per-person totals (unregularized only in the totals). */
final class LateEarly
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(string $from, string $to, array $ids): array
    {
        $emps = Employee::whereIn('id', $ids)->get()->keyBy('id');
        $days = AttendanceDay::whereIn('employee_id', $ids)->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
            ->where(fn ($q) => $q->where('late_minutes', '>', 0)->orWhere('early_minutes', '>', 0))
            ->orderBy('date')->get();

        $rows = [];
        $per = [];
        foreach ($days as $d) {
            $e = $emps[$d->employee_id] ?? null;
            if (! $e) {
                continue;
            }
            foreach (['late' => 'Late', 'early' => 'Early leave'] as $k => $label) {
                $m = (int) $d->{$k.'_minutes'};
                if ($m <= 0) {
                    continue;
                }
                $rows[] = [
                    'date' => $d->date->format('Y-m-d'), 'code' => $e->code, 'name' => $e->name, 'kind' => $label, 'minutes' => $m,
                    'time' => $k === 'late' ? ($d->first_in_at?->timezone(config('app.timezone'))->format('H:i') ?? '') : ($d->last_out_at?->timezone(config('app.timezone'))->format('H:i') ?? ''),
                    'regularized' => $d->is_regularized ? 'Yes' : 'No',
                ];
                if (! $d->is_regularized) {
                    $per[$e->id] ??= ['code' => $e->code, 'name' => $e->name, 'late' => 0, 'late_min' => 0, 'early' => 0, 'early_min' => 0];
                    $per[$e->id][$k]++;
                    $per[$e->id][$k.'_min'] += $m;
                }
            }
        }
        usort($rows, fn ($a, $b) => [$a['date'], $a['name'], $a['kind']] <=> [$b['date'], $b['name'], $b['kind']]);
        $totals = array_values($per);
        usort($totals, fn ($a, $b) => $b['late_min'] + $b['early_min'] <=> $a['late_min'] + $a['early_min']);

        return Table::make([
            ['date', 'Date', 'date'], ['code', 'Code'], ['name', 'Employee'], ['kind', 'Type'], ['time', 'Time'], ['minutes', 'Minutes', 'int'], ['regularized', 'Regularized'],
        ], $rows, null, [
            'title' => 'Per person, not regularized',
            'columns' => Table::make([
                ['code', 'Code'], ['name', 'Employee'], ['late', 'Late', 'int'], ['late_min', 'Late min', 'int'], ['early', 'Early leave', 'int'], ['early_min', 'Early min', 'int'],
            ], [])['columns'],
            'rows' => $totals,
        ]);
    }
}
