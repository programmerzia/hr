<?php

namespace App\Domain\Reports;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Team;
use Carbon\CarbonImmutable;

/**
 * Employee x day grid. Codes: P present, ½ half day, A unapproved absence, L paid leave,
 * U unpaid leave, H holiday, W weekend, - future or not yet closed, '' outside the employment window.
 * Source is attendance_days with the payroll fallback: a past working date with no row is A unless leave covers it.
 */
final class AttendanceSheet
{
    public const HALF = '½';

    /** @param list<string> $employeeIds @return array<string,mixed> */
    public static function for(int $year, int $month, array $employeeIds): array
    {
        $policy = AttendancePolicy::current();
        $weekend = $policy->weekend_days ?? [];
        $first = PayrollPeriod::start($year, $month);
        $last = PayrollPeriod::end($year, $month);
        $holidays = PayrollPeriod::holidayDates($year, $month);
        $today = now()->toDateString();

        $dates = [];
        for ($d = CarbonImmutable::parse($first); $d->toDateString() <= $last; $d = $d->addDay()) {
            $dates[] = $d->toDateString();
        }
        $days = array_map(fn ($d) => [
            'date' => $d, 'day' => (int) substr($d, 8, 2), 'dow' => CarbonImmutable::parse($d)->format('D'),
            'type' => in_array(CarbonImmutable::parse($d)->dayOfWeek, $weekend, true) ? 'weekend' : (isset($holidays[$d]) ? 'holiday' : 'work'),
        ], $dates);

        $employees = Employee::whereIn('id', $employeeIds)->orderBy('name')->get();
        $depts = Department::pluck('name', 'id');
        $teams = Team::pluck('name', 'id');
        $att = AttendanceDay::whereIn('employee_id', $employeeIds)->whereDate('date', '>=', $first)->whereDate('date', '<=', $last)->get()
            ->groupBy('employee_id');
        $leaves = LeaveRequest::with('leaveType')->whereIn('employee_id', $employeeIds)->where('status', 'approved')
            ->whereDate('starts_on', '<=', $last)->whereDate('ends_on', '>=', $first)->get()->groupBy('employee_id');

        $rows = [];
        foreach ($employees as $e) {
            $byDate = ($att[$e->id] ?? collect())->keyBy(fn ($r) => $r->date->format('Y-m-d'));
            $paid = self::leaveWeights($leaves[$e->id] ?? collect(), true);
            $unpaid = self::leaveWeights($leaves[$e->id] ?? collect(), false);
            $from = $e->joined_on?->format('Y-m-d');
            $to = $e->exited_on?->format('Y-m-d');
            $cells = [];
            $t = ['present' => 0, 'half' => 0, 'absent' => 0, 'leave' => 0, 'late' => 0];
            foreach ($days as $day) {
                $date = $day['date'];
                $row = $byDate[$date] ?? null;
                $code = ($from && $date < $from) || ($to && $date > $to)
                    ? ''
                    : self::code($day['type'], $date, $today, $row, $paid[$date] ?? 0.0, $unpaid[$date] ?? 0.0);
                $cells[] = $code;
                match ($code) {
                    'P' => $t['present']++,
                    self::HALF => $t['half']++,
                    'A' => $t['absent']++,
                    'L', 'U' => $t['leave']++,
                    default => null,
                };
                if ($row && ! $row->is_regularized && (int) $row->late_minutes > 0) {
                    $t['late']++;
                }
            }
            $rows[] = [
                'employee' => [
                    'id' => $e->id, 'name' => $e->name, 'code' => $e->code,
                    'department' => $depts[$e->department_id] ?? null, 'team' => $teams[$e->team_id] ?? null,
                ],
                'cells' => $cells,
                'totals' => $t,
            ];
        }

        return ['year' => $year, 'month' => $month, 'label' => CarbonImmutable::create($year, $month, 1)->format('F Y'), 'days' => $days, 'rows' => $rows];
    }

    private static function code(string $type, string $date, string $today, ?AttendanceDay $row, float $paid, float $unpaid): string
    {
        if ($row) {
            $kind = (string) ($row->absence_kind ?? 'none');
            $fraction = (float) $row->day_fraction;
            if ($type !== 'work' && $kind !== 'paid_leave' && $kind !== 'unpaid_leave' && $fraction <= 0 && (int) $row->work_seconds === 0) {
                return $type === 'weekend' ? 'W' : 'H';
            }

            return match (true) {
                $kind === 'paid_leave' => 'L',
                $kind === 'unpaid_leave' => 'U',
                $kind === 'holiday' => 'H',
                $kind === 'weekend' => 'W',
                $kind === 'excused' => 'P',
                $date > $today => '-',
                $fraction >= 1 => 'P',
                $fraction > 0 => self::HALF,
                $paid >= 1 => 'L',
                $unpaid >= 1 => 'U',
                default => 'A',
            };
        }
        if ($type === 'weekend') {
            return 'W';
        }
        if ($type === 'holiday') {
            return 'H';
        }
        if ($date >= $today) {
            return '-';
        }
        if ($paid >= 1) {
            return 'L';
        }
        if ($unpaid >= 1) {
            return 'U';
        }

        return $paid > 0 || $unpaid > 0 ? self::HALF : 'A';
    }

    /** @param iterable<LeaveRequest> $requests @return array<string,float> */
    private static function leaveWeights(iterable $requests, bool $paid): array
    {
        $out = [];
        foreach ($requests as $r) {
            if (! $r->leaveType || (bool) $r->leaveType->is_paid !== $paid) {
                continue;
            }
            $a = $r->starts_on->format('Y-m-d');
            $b = $r->ends_on->format('Y-m-d');
            $w = $r->half_day !== 'none' && $a === $b ? 0.5 : 1.0;
            for ($d = CarbonImmutable::parse($a); $d->toDateString() <= $b; $d = $d->addDay()) {
                $out[$d->toDateString()] = max($out[$d->toDateString()] ?? 0, $w);
            }
        }

        return $out;
    }
}
