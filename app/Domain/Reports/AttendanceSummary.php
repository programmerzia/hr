<?php

namespace App\Domain\Reports;

use App\Domain\Attendance\Services\DayGrader;
use App\Domain\Attendance\Services\Overtime;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Team;

/**
 * Monthly attendance per employee. Day outcomes (present, half, absent, paid/unpaid leave) come from AttendanceSheet,
 * late/early/regularized from the graded attendance_days, overtime through Overtime/DayGrader.
 * Late and early count only days that were not regularized, as payroll does.
 */
final class AttendanceSummary
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(int $year, int $month, array $ids): array
    {
        $sheet = AttendanceSheet::for($year, $month, $ids);
        $first = sprintf('%04d-%02d-01', $year, $month);
        $last = \Carbon\CarbonImmutable::create($year, $month, 1)->endOfMonth()->toDateString();
        $days = AttendanceDay::whereIn('employee_id', $ids)->whereDate('date', '>=', $first)->whereDate('date', '<=', $last)->get()->groupBy('employee_id');
        $seg = SegmentTotals::forDays($days->flatten()->pluck('id')->all());
        $typeOf = collect($sheet['days'])->pluck('type', 'date');
        $leaves = LeaveRequest::with('leaveType')->whereIn('employee_id', $ids)->where('status', 'approved')
            ->whereDate('starts_on', '<=', $last)->whereDate('ends_on', '>=', $first)->get()->groupBy('employee_id');
        $needsApproval = [];
        $depts = Department::pluck('name', 'id');
        $teams = Team::pluck('name', 'id');
        $emp = Employee::whereIn('id', $ids)->get()->keyBy('id');

        $rows = [];
        $sum = [];
        foreach ($sheet['rows'] as $r) {
            $id = $r['employee']['id'];
            $count = array_count_values($r['cells']);
            $t = ['late' => 0, 'late_min' => 0, 'early' => 0, 'early_min' => 0, 'reg' => 0, 'work' => 0, 'break' => 0, 'offline' => 0, 'idle' => 0, 'ot' => 0];
            foreach ($days[$id] ?? [] as $d) {
                $date = $d->date->format('Y-m-d');
                if (! $d->is_regularized && (int) $d->late_minutes > 0) {
                    $t['late']++;
                    $t['late_min'] += (int) $d->late_minutes;
                }
                if (! $d->is_regularized && (int) $d->early_minutes > 0) {
                    $t['early']++;
                    $t['early_min'] += (int) $d->early_minutes;
                }
                $t['reg'] += $d->is_regularized ? 1 : 0;
                $t['work'] += (int) $d->work_seconds;
                $s = $seg[$d->id] ?? ['break' => 0, 'offline' => 0, 'idle' => 0];
                $t['break'] += $s['break'];
                $t['offline'] += $s['offline'];
                $t['idle'] += $s['idle'];
                if ((int) $d->work_seconds > 0) {
                    $needsApproval[$date] ??= Overtime::needsApproval($date);
                    $t['ot'] += $needsApproval[$date]
                        ? (int) $d->approved_overtime_minutes
                        : self::rawOvertime($d, $date, $typeOf[$date] ?? 'work', $leaves[$id] ?? collect());
                }
            }
            $present = ($count['P'] ?? 0);
            $row = [
                'code' => $r['employee']['code'], 'name' => $r['employee']['name'],
                'department' => $depts[$emp[$id]->department_id] ?? '', 'team' => $teams[$emp[$id]->team_id] ?? '',
                'working_days' => $present + ($count['½'] ?? 0) + ($count['A'] ?? 0) + ($count['L'] ?? 0) + ($count['U'] ?? 0),
                'present' => $present, 'late' => $t['late'], 'late_minutes' => $t['late_min'],
                'early' => $t['early'], 'early_minutes' => $t['early_min'],
                'half' => $count['½'] ?? 0, 'absent' => $count['A'] ?? 0,
                'leave_paid' => $count['L'] ?? 0, 'leave_unpaid' => $count['U'] ?? 0,
                'work_hours' => Table::hours($t['work']), 'break_hours' => Table::hours($t['break']),
                'offline_hours' => Table::hours($t['offline']), 'idle_hours' => Table::hours($t['idle']),
                'overtime_hours' => Table::hoursFromMinutes($t['ot']), 'regularized' => $t['reg'],
            ];
            foreach (array_keys($row) as $k) {
                if (! in_array($k, ['code', 'name', 'department', 'team'], true)) {
                    $sum[$k] = round(($sum[$k] ?? 0) + $row[$k], 2);
                }
            }
            $rows[] = $row;
        }

        $cols = [
            ['code', 'Code'], ['name', 'Employee'], ['department', 'Department'], ['team', 'Team'],
            ['working_days', 'Working days', 'int'], ['present', 'Present', 'int'],
            ['late', 'Late', 'int'], ['late_minutes', 'Late min', 'int'], ['early', 'Early leave', 'int'], ['early_minutes', 'Early min', 'int'],
            ['half', 'Half days', 'int'], ['absent', 'Absent', 'int'], ['leave_paid', 'Paid leave', 'int'], ['leave_unpaid', 'Unpaid leave', 'int'],
            ['work_hours', 'Work h', 'dec'], ['break_hours', 'Break h', 'dec'], ['offline_hours', 'Offline h', 'dec'], ['idle_hours', 'Idle h', 'dec'],
            ['overtime_hours', 'Overtime h', 'dec'], ['regularized', 'Regularized', 'int'],
        ];

        return Table::make($cols, $rows, ['code' => '', 'name' => 'Total', ...$sum], null, ['label' => $sheet['label']]);
    }

    private static function rawOvertime(AttendanceDay $d, string $date, string $type, $leaves): int
    {
        $weight = 0.0;
        $paid = false;
        foreach ($leaves as $l) {
            if ($l->starts_on->format('Y-m-d') <= $date && $l->ends_on->format('Y-m-d') >= $date) {
                $w = $l->half_day !== 'none' && $l->starts_on->equalTo($l->ends_on) ? 0.5 : 1.0;
                if ($w > $weight) {
                    $weight = $w;
                    $paid = (bool) $l->leaveType?->is_paid;
                }
            }
        }

        return Overtime::raw($d, [
            'is_weekend' => $type === 'weekend', 'is_holiday' => $type === 'holiday', 'leave_weight' => $weight, 'leave_paid' => $paid,
        ]);
    }
}
