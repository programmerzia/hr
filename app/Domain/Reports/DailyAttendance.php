<?php

namespace App\Domain\Reports;

use App\Models\AttendanceDay;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\AttendancePolicy;
use App\Models\LeaveRequest;

/** One date, one row per employee in the employment window. On today it also lists who is in right now. */
final class DailyAttendance
{
    private const KIND = [
        'unapproved' => 'Absent', 'half_day' => 'Half day', 'paid_leave' => 'Paid leave', 'unpaid_leave' => 'Unpaid leave',
        'holiday' => 'Holiday', 'weekend' => 'Weekend', 'excused' => 'Excused',
    ];

    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(string $date, array $ids): array
    {
        $today = now()->toDateString();
        $emps = Employee::whereIn('id', $ids)->whereDate('joined_on', '<=', $date)
            ->where(fn ($q) => $q->whereNull('exited_on')->orWhereDate('exited_on', '>=', $date))->orderBy('name')->get();
        $depts = Department::pluck('name', 'id');
        $days = AttendanceDay::whereIn('employee_id', $emps->pluck('id'))->whereDate('date', $date)->get()->keyBy('employee_id');
        $seg = SegmentTotals::forDays($days->pluck('id')->all());
        $weekend = in_array((int) date('w', strtotime($date)), array_map('intval', AttendancePolicy::forDate($date)->weekend_days ?? [5, 6]), true);
        $holiday = Holiday::whereDate('date', $date)->exists();
        $leave = LeaveRequest::with('leaveType')->whereIn('employee_id', $emps->pluck('id'))->where('status', 'approved')
            ->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->get()->keyBy('employee_id');

        $rows = [];
        $in = [];
        foreach ($emps as $e) {
            $d = $days[$e->id] ?? null;
            $s = $d ? ($seg[$d->id] ?? ['break' => 0, 'offline' => 0, 'idle' => 0]) : ['break' => 0, 'offline' => 0, 'idle' => 0];
            if ($d) {
                $status = self::KIND[$d->absence_kind] ?? null;
                if ($d->absence_kind === 'none' || $status === null || $status === 'Excused') {
                    $status = $date === $today && in_array($d->status, ['working', 'on_break'], true)
                        ? ($d->status === 'working' ? 'Working' : 'On break') : ($d->day_fraction > 0 ? 'Present' : 'Absent');
                }
                if ($date === $today && in_array($d->status, ['working', 'on_break'], true)) {
                    $in[] = ['name' => $e->name, 'since' => $d->first_in_at?->timezone(config('app.timezone'))->format('H:i'), 'status' => $d->status === 'working' ? 'Working' : 'On break'];
                }
            } else {
                $status = match (true) {
                    $weekend => 'Weekend', $holiday => 'Holiday', isset($leave[$e->id]) => ($leave[$e->id]->leaveType?->is_paid ? 'Paid leave' : 'Unpaid leave'),
                    $date > $today => '', $date === $today => 'Not in yet', default => 'Absent',
                };
            }
            $rows[] = [
                'code' => $e->code, 'name' => $e->name, 'department' => $depts[$e->department_id] ?? '',
                'first_in' => $d?->first_in_at?->timezone(config('app.timezone'))->format('H:i') ?? '',
                'last_out' => $d?->last_out_at?->timezone(config('app.timezone'))->format('H:i') ?? '',
                'work_hours' => $d ? Table::hours((int) $d->work_seconds) : 0.0,
                'break_hours' => Table::hours($s['break']), 'offline_hours' => Table::hours($s['offline']),
                'status' => $status,
                'late_minutes' => $d && ! $d->is_regularized ? (int) $d->late_minutes : 0,
                'early_minutes' => $d && ! $d->is_regularized ? (int) $d->early_minutes : 0,
            ];
        }

        return Table::make([
            ['code', 'Code'], ['name', 'Employee'], ['department', 'Department'], ['first_in', 'First in'], ['last_out', 'Last out'],
            ['work_hours', 'Work h', 'dec'], ['break_hours', 'Break h', 'dec'], ['offline_hours', 'Offline h', 'dec'],
            ['status', 'Status'], ['late_minutes', 'Late min', 'int'], ['early_minutes', 'Early min', 'int'],
        ], $rows, null, null, ['label' => $date, 'in_now' => $date === $today ? $in : null]);
    }
}
