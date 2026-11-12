<?php

namespace App\Domain\Reports;

use Carbon\CarbonImmutable;

/** Payroll totals per month for the last N calendar months (oldest first), zero-filled. */
final class MonthlySummary
{
    /** @return list<array<string,mixed>> */
    public static function months(int $count = 12): array
    {
        $end = CarbonImmutable::now()->startOfMonth();
        $start = $end->subMonths($count - 1);
        $rows = PaidItems::rows(PaidItems::query()
            ->where(fn ($q) => $q->where('payroll_runs.year', '>', $start->year)
                ->orWhere(fn ($q) => $q->where('payroll_runs.year', $start->year)->where('payroll_runs.month', '>=', $start->month)))
            ->where(fn ($q) => $q->where('payroll_runs.year', '<', $end->year)
                ->orWhere(fn ($q) => $q->where('payroll_runs.year', $end->year)->where('payroll_runs.month', '<=', $end->month))))
            ->groupBy(fn ($r) => $r['year'] * 100 + $r['month']);

        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $d = $start->addMonths($i);
            $month = $rows[$d->year * 100 + $d->month] ?? collect();
            $out[] = [
                'year' => $d->year,
                'month' => $d->month,
                'label' => $d->format('M Y'),
                'headcount' => $month->count(),
                ...PaidItems::sum($month),
            ];
        }

        return $out;
    }
}
