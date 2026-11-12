<?php

namespace App\Domain\Reports;

use App\Models\PayrollItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Snapshot rows for reports: items of regular runs that are approved or paid, never held, never recomputed.
 * Each row is a flat array of integers (BDT) plus run_year / run_month.
 */
final class PaidItems
{
    public const FIELDS = ['gross', 'overtime', 'bonus', 'lop', 'late', 'tax', 'pf_employee', 'pf_employer', 'other_deductions', 'net'];

    /** @return Builder<PayrollItem> */
    public static function query(): Builder
    {
        return PayrollItem::query()
            ->join('payroll_runs', 'payroll_runs.id', '=', 'payroll_items.run_id')
            ->whereIn('payroll_runs.status', ['approved', 'paid'])
            ->where('payroll_runs.kind', 'regular')
            ->where('payroll_items.hold', false)
            ->select('payroll_items.*', 'payroll_runs.year as run_year', 'payroll_runs.month as run_month');
    }

    /** @param Builder<PayrollItem> $query @return Collection<int,array<string,mixed>> */
    public static function rows(Builder $query): Collection
    {
        $items = $query->get();
        $adj = DB::table('payroll_adjustments')->whereIn('item_id', $items->pluck('id'))
            ->select('item_id', 'kind', DB::raw('SUM(amount) as total'))->groupBy('item_id', 'kind')->get()
            ->groupBy('item_id');

        return $items->map(function ($i) use ($adj) {
            $a = ($adj[$i->id] ?? collect())->pluck('total', 'kind');

            return [
                'employee_id' => $i->employee_id,
                'year' => (int) $i->run_year,
                'month' => (int) $i->run_month,
                'gross' => (int) $i->gross,
                'overtime' => (int) $i->overtime_pay,
                'bonus' => (int) ($a['bonus'] ?? 0),
                'lop' => (int) $i->unpaid_deduction,
                'late' => (int) $i->late_deduction,
                'tax' => (int) $i->tax,
                'pf_employee' => (int) $i->pf,
                'pf_employer' => (int) $i->pf_employer,
                'other_deductions' => (int) ($a['deduction'] ?? 0),
                'net' => (int) $i->net,
                'employer_cost' => (int) $i->gross + (int) $i->overtime_pay + (int) ($a['bonus'] ?? 0) + (int) $i->pf_employer,
            ];
        });
    }

    /** @param Collection<int,array<string,mixed>> $rows @return array<string,int> */
    public static function sum(Collection $rows): array
    {
        $out = [];
        foreach ([...self::FIELDS, 'employer_cost'] as $f) {
            $out[$f] = (int) $rows->sum($f);
        }

        return $out;
    }
}
