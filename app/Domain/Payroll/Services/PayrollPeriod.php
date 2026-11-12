<?php

namespace App\Domain\Payroll\Services;

use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\PayrollRun;
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

    /** Human title of a run: the month, plus the festival label or "Final settlement" for extra runs. */
    public static function runTitle(PayrollRun $run): string
    {
        $month = self::label($run->year, $run->month);

        return match ($run->kind) {
            'festival' => ($run->label ?: 'Festival bonus').', '.$month,
            'settlement' => 'Final settlement, '.$month,
            default => $month,
        };
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
    public static function workingDates(int $y, int $m, ?AttendancePolicy $policy = null): array
    {
        $weekend = ($policy ?? AttendancePolicy::current())->weekend_days ?? [];
        $first = self::start($y, $m);
        $last = self::end($y, $m);
        $holidays = self::holidayDates($y, $m);
        $out = [];
        for ($d = CarbonImmutable::parse($first); $d->toDateString() <= $last; $d = $d->addDay()) {
            if (in_array($d->dayOfWeek, $weekend, true) || isset($holidays[$d->toDateString()])) {
                continue;
            }
            $out[] = $d->toDateString();
        }

        return $out;
    }

    /** @return array<string,true> holiday dates in the month */
    public static function holidayDates(int $y, int $m): array
    {
        return Holiday::whereDate('date', '>=', self::start($y, $m))->whereDate('date', '<=', self::end($y, $m))->get()
            ->mapWithKeys(fn ($h) => [$h->date->format('Y-m-d') => true])->all();
    }

    public static function salaryOn(string $employeeId, string $onDate): ?SalaryStructure
    {
        return SalaryStructure::where('employee_id', $employeeId)->whereDate('effective_from', '<=', $onDate)
            ->orderByDesc('effective_from')->first();
    }
}
