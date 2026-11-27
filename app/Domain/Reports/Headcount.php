<?php

namespace App\Domain\Reports;

use App\Models\Department;
use App\Models\Employee;
use Carbon\CarbonImmutable;

/** Active people by department on the end date, joiners and leavers in the range, tenure in years. */
final class Headcount
{
    /** @return array<string,mixed> */
    public static function for(string $from, string $to, ?string $department = null): array
    {
        $end = CarbonImmutable::parse($to);
        $depts = Department::orderBy('name')->get();
        $all = Employee::when($department, fn ($q) => $q->where('department_id', $department))->get();
        $rows = [];
        $moves = [];
        $t = ['active' => 0, 'joiners' => 0, 'leavers' => 0];
        foreach ($depts as $d) {
            $mine = $all->where('department_id', $d->id);
            $active = $mine->filter(fn ($e) => $e->joined_on->format('Y-m-d') <= $to && ($e->exited_on === null || $e->exited_on->format('Y-m-d') > $to));
            $joined = $mine->filter(fn ($e) => $e->joined_on->format('Y-m-d') >= $from && $e->joined_on->format('Y-m-d') <= $to);
            $left = $mine->filter(fn ($e) => $e->exited_on && $e->exited_on->format('Y-m-d') >= $from && $e->exited_on->format('Y-m-d') <= $to);
            if ($active->isEmpty() && $joined->isEmpty() && $left->isEmpty()) {
                continue;
            }
            $tenure = $active->map(fn ($e) => $e->joined_on->diffInDays($end) / 365.25);
            $rows[] = [
                'department' => $d->name, 'active' => $active->count(), 'joiners' => $joined->count(), 'leavers' => $left->count(),
                'avg_tenure' => round((float) $tenure->avg(), 1), 'max_tenure' => round((float) $tenure->max(), 1),
            ];
            $t['active'] += $active->count();
            $t['joiners'] += $joined->count();
            $t['leavers'] += $left->count();
            foreach ($joined as $e) {
                $moves[] = ['date' => $e->joined_on->format('Y-m-d'), 'code' => $e->code, 'name' => $e->name, 'department' => $d->name, 'event' => 'Joined', 'tenure' => 0.0];
            }
            foreach ($left as $e) {
                $moves[] = ['date' => $e->exited_on->format('Y-m-d'), 'code' => $e->code, 'name' => $e->name, 'department' => $d->name, 'event' => 'Left', 'tenure' => round($e->joined_on->diffInDays($e->exited_on) / 365.25, 1)];
            }
        }
        usort($moves, fn ($a, $b) => $a['date'] <=> $b['date']);

        return Table::make([
            ['department', 'Department'], ['active', 'Active', 'int'], ['joiners', 'Joiners', 'int'], ['leavers', 'Leavers', 'int'],
            ['avg_tenure', 'Avg tenure (yrs)', 'dec'], ['max_tenure', 'Longest (yrs)', 'dec'],
        ], $rows, ['department' => 'Total', ...$t], [
            'title' => 'Joiners and leavers',
            'columns' => Table::make([['date', 'Date', 'date'], ['code', 'Code'], ['name', 'Employee'], ['department', 'Department'], ['event', 'Event'], ['tenure', 'Tenure (yrs)', 'dec']], [])['columns'],
            'rows' => $moves,
        ]);
    }
}
