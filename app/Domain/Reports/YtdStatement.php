<?php

namespace App\Domain\Reports;

use App\Models\Employee;
use App\Models\PfLedger;
use Carbon\CarbonImmutable;

/** Bangladesh tax year (July to June) statement for one employee. $taxYear is the starting year: 2026 = "2026-27". */
final class YtdStatement
{
    public static function label(int $taxYear): string
    {
        return $taxYear.'-'.substr((string) ($taxYear + 1), 2);
    }

    /** Tax year containing a calendar month. */
    public static function taxYearOf(int $year, int $month): int
    {
        return $month >= 7 ? $year : $year - 1;
    }

    /** @return array<string,mixed> */
    public static function for(Employee $employee, int $taxYear): array
    {
        $start = CarbonImmutable::create($taxYear, 7, 1);
        $rows = PaidItems::rows(PaidItems::query()->where('payroll_items.employee_id', $employee->id)
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('payroll_runs.year', $taxYear)->where('payroll_runs.month', '>=', 7))
                ->orWhere(fn ($q) => $q->where('payroll_runs.year', $taxYear + 1)->where('payroll_runs.month', '<=', 6))))
            ->keyBy(fn ($r) => $r['year'] * 100 + $r['month']);
        $ledger = PfLedger::where('employee_id', $employee->id)->get()->keyBy(fn ($l) => $l->year * 100 + $l->month);

        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $d = $start->addMonths($i);
            $key = $d->year * 100 + $d->month;
            $r = $rows[$key] ?? null;
            $pf = $ledger[$key] ?? null;
            $months[] = [
                'year' => $d->year,
                'month' => $d->month,
                'label' => $d->format('M Y'),
                'paid' => $r !== null,
                ...collect([...PaidItems::FIELDS, 'employer_cost'])->mapWithKeys(fn ($f) => [$f => $r[$f] ?? 0])->all(),
                'pf_cumulative_employee' => $pf?->cumulative_employee,
                'pf_cumulative_employer' => $pf?->cumulative_employer,
            ];
        }
        $last = collect($months)->filter(fn ($m) => $m['pf_cumulative_employee'] !== null)->last();

        return [
            'employee' => ['id' => $employee->id, 'name' => $employee->name, 'code' => $employee->code, 'designation' => $employee->designation ?? null],
            'tax_year' => $taxYear,
            'label' => self::label($taxYear),
            'months' => $months,
            'totals' => PaidItems::sum($rows),
            'pf_balance' => $last ? ['employee' => $last['pf_cumulative_employee'], 'employer' => $last['pf_cumulative_employer']] : null,
        ];
    }

    /** Tax years in which the employee has reportable items, newest first; always includes the current one. @return list<int> */
    public static function yearsFor(Employee $employee): array
    {
        $now = CarbonImmutable::now();
        $years = [self::taxYearOf($now->year, $now->month)];
        foreach (PaidItems::rows(PaidItems::query()->where('payroll_items.employee_id', $employee->id)) as $r) {
            $years[] = self::taxYearOf($r['year'], $r['month']);
        }
        $years = array_values(array_unique($years));
        rsort($years);

        return $years;
    }
}
