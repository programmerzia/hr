<?php

namespace App\Domain\Payroll\Services;

use App\Domain\Payroll\Support\Csv;
use App\Models\BankAccount;
use App\Models\Department;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Support\Str;

/** One row per employee: earnings, adjustments by category, deductions, net, bank. */
final class PayrollRegister
{
    public static function filename(PayrollRun $run): string
    {
        $suffix = $run->kind === 'regular' ? '' : '-'.$run->kind.($run->label ? '-'.Str::slug($run->label) : '');

        return sprintf('payroll-register-%d-%02d%s.csv', $run->year, $run->month, $suffix);
    }

    public static function csv(PayrollRun $run): string
    {
        $earn = array_keys(array_filter(PayrollAdjustment::CATEGORIES, fn ($c) => $c[0] === 'bonus'));
        $ded = array_keys(array_filter(PayrollAdjustment::CATEGORIES, fn ($c) => $c[0] === 'deduction'));
        $header = [
            'code', 'name', 'department', 'payable_days', 'gross', 'basic', 'house_rent', 'medical', 'conveyance', 'other_allowances',
            'overtime', 'leave_encashment',
            ...array_map(fn ($c) => 'adj_'.$c, $earn),
            'lop_days', 'lop', 'late_count', 'late_penalty', 'pf', 'pf_employer', 'tax',
            ...array_map(fn ($c) => 'adj_'.$c, $ded),
            'net', 'status', 'bank', 'account_no',
        ];
        $items = PayrollItem::with('employee')->where('run_id', $run->id)->get()->sortBy(fn ($i) => $i->employee?->code)->values();
        $adj = PayrollAdjustment::whereIn('item_id', $items->pluck('id'))->get()->groupBy('item_id');
        $accounts = BankAccount::whereIn('id', $items->pluck('bank_account_id')->filter())->get()->keyBy('id');
        $departments = Department::whereIn('id', $items->map->employee->filter()->pluck('department_id')->filter())->pluck('name', 'id');

        $rows = $items->map(function (PayrollItem $i) use ($adj, $accounts, $departments, $earn, $ded) {
            $by = ($adj[$i->id] ?? collect())->groupBy('category')->map(fn ($g) => (int) $g->sum('amount'));
            $c = $i->components ?? [];
            $bank = $accounts[$i->bank_account_id] ?? null;

            return [
                $i->employee?->code ?? '', $i->employee?->name ?? '', $departments[$i->employee?->department_id] ?? '', $i->eligible_days,
                $i->gross, $c['basic'] ?? 0, $c['house_rent'] ?? 0, $c['medical'] ?? 0, $c['conveyance'] ?? 0,
                array_sum(array_column($c['other_allowances'] ?? [], 'amount')),
                $i->overtime_pay, (int) $i->leave_encashment,
                ...array_map(fn ($k) => $by[$k] ?? 0, $earn),
                $i->lop_days, $i->unpaid_deduction, $i->late_count, $i->late_deduction, $i->pf, $i->pf_employer, $i->tax,
                ...array_map(fn ($k) => $by[$k] ?? 0, $ded),
                (int) $i->net, $i->hold ? 'held' : ((int) $i->net > 0 ? 'pay' : 'not payable'),
                $bank->bank ?? '', $bank->account_no ?? '',
            ];
        })->all();

        return Csv::render($header, $rows);
    }
}
