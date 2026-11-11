<?php

namespace App\Domain\Payroll\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\SalaryStructure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Month helpers and fact gathering, ported from mock/db/payroll.ts and factsFor() in mock/stores/payroll.ts. */
final class PayrollPeriod
{
    public static function start(int $y, int $m): string
    {
        return sprintf('%04d-%02d-01', $y, $m);
    }

    public static function end(int $y, int $m): string
    {
        return CarbonImmutable::create($y, $m, 1)->endOfMonth()->toDateString();
    }

    public static function label(int $y, int $m): string
    {
        return CarbonImmutable::create($y, $m, 1)->format('F Y');
    }

    /** Full-time employees who joined by month end and had not exited before it began. @return Collection<int,Employee> */
    public static function eligible(int $y, int $m): Collection
    {
        $first = self::start($y, $m);
        $last = self::end($y, $m);

        return Employee::where('employment_type', 'full_time')
            ->whereDate('joined_on', '<=', $last)
            ->where(fn ($q) => $q->whereNull('exited_on')->orWhereDate('exited_on', '>=', $first))
            ->orderBy('code')->get();
    }

    /** Dates in the month that are neither weekend nor holiday. @return list<string> */
    public static function workingDates(int $y, int $m): array
    {
        $weekend = AttendancePolicy::current()->weekend_days ?? [];
        $first = self::start($y, $m);
        $last = self::end($y, $m);
        $holidays = Holiday::whereDate('date', '>=', $first)->whereDate('date', '<=', $last)->get()
            ->map(fn ($h) => $h->date->format('Y-m-d'))->flip();
        $out = [];
        for ($d = CarbonImmutable::parse($first); $d->toDateString() <= $last; $d = $d->addDay()) {
            if (in_array($d->dayOfWeek, $weekend, true) || isset($holidays[$d->toDateString()])) {
                continue;
            }
            $out[] = $d->toDateString();
        }

        return $out;
    }

    public static function salaryOn(string $employeeId, string $onDate): ?SalaryStructure
    {
        return SalaryStructure::where('employee_id', $employeeId)->whereDate('effective_from', '<=', $onDate)
            ->orderByDesc('effective_from')->first();
    }

    /** @param list<string> $dates @return array<string,float> days of approved leave (weight per date) */
    private static function leaveWeights(string $employeeId, array $dates, bool $paid): array
    {
        $out = [];
        $requests = LeaveRequest::with('leaveType')->where('employee_id', $employeeId)->where('status', 'approved')->get();
        foreach ($requests as $r) {
            if (! $r->leaveType || (bool) $r->leaveType->is_paid !== $paid) {
                continue;
            }
            $from = $r->starts_on->format('Y-m-d');
            $to = $r->ends_on->format('Y-m-d');
            foreach ($dates as $d) {
                if ($d < $from || $d > $to) {
                    continue;
                }
                $w = $r->half_day !== 'none' && $from === $to ? 0.5 : 1.0;
                $out[$d] = max($out[$d] ?? 0, $w);
            }
        }

        return $out;
    }

    /** @return array{working_days:int,worked_minutes:int,unpaid_days:float,late_count:int} */
    public static function facts(string $employeeId, int $y, int $m): array
    {
        $dates = self::workingDates($y, $m);
        $std = (int) AttendancePolicy::current()->standard_minutes;
        $days = AttendanceDay::where('employee_id', $employeeId)
            ->whereDate('date', '>=', self::start($y, $m))->whereDate('date', '<=', self::end($y, $m))->get();
        $unpaid = self::leaveWeights($employeeId, $dates, false);
        $paidLeave = self::leaveWeights($employeeId, $dates, true);
        $unpaidDays = array_sum($unpaid);
        $lateCount = $days->filter(fn ($d) => $d->late_minutes > 0 && ! $d->is_regularized)->count();

        if ($days->isEmpty()) {
            $worked = count($dates) * $std - $unpaidDays * $std;
        } else {
            $today = now()->toDateString();
            $recorded = $days->map(fn ($d) => $d->date->format('Y-m-d'))->flip();
            $worked = $days->sum(fn ($d) => (int) round($d->work_seconds / 60));
            foreach ($dates as $date) {
                if (isset($recorded[$date])) {
                    continue;
                }
                $worked += $date > $today ? $std : ($paidLeave[$date] ?? 0) * $std;
            }
            foreach ($days as $d) {
                $w = $paidLeave[$d->date->format('Y-m-d')] ?? 0;
                if ($w && (int) $d->work_seconds === 0) {
                    $worked += $w * $std;
                }
            }
        }

        return [
            'working_days' => count($dates),
            'worked_minutes' => (int) max(0, round($worked)),
            'unpaid_days' => (float) $unpaidDays,
            'late_count' => $lateCount,
        ];
    }
}
