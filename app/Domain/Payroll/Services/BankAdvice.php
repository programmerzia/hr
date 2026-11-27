<?php

namespace App\Domain\Payroll\Services;

use App\Models\BankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Domain\Payroll\Support\Csv;
use Illuminate\Support\Str;

/** Bank advice CSV for an approved or paid run. Held items and items with net <= 0 are excluded. */
final class BankAdvice
{
    public static function filename(PayrollRun $run): string
    {
        $suffix = $run->kind === 'regular' ? '' : '-'.$run->kind.($run->label ? '-'.Str::slug($run->label) : '');

        return sprintf('bank-advice-%d-%02d%s.csv', $run->year, $run->month, $suffix);
    }

    public const HEADER = ['code', 'name', 'bank', 'branch', 'account_name', 'account_no', 'routing_no', 'net'];

    /** @return list<list<string|int>> */
    public static function rows(PayrollRun $run): array
    {
        $items = PayrollItem::with('employee')->where('run_id', $run->id)->where('hold', false)->where('net', '>', 0)->get()
            ->sortBy(fn ($i) => $i->employee?->code)->values();
        $accounts = BankAccount::whereIn('id', $items->pluck('bank_account_id')->filter())->get()->keyBy('id');

        return $items->map(function (PayrollItem $i) use ($accounts) {
            $a = $accounts[$i->bank_account_id] ?? null;

            return [
                $i->employee?->code ?? '', $i->employee?->name ?? '', $a->bank ?? '', $a->branch ?? '',
                $a->account_name ?? '', $a->account_no ?? '', $a->routing_no ?? '', (int) $i->net,
            ];
        })->all();
    }

    public static function csv(PayrollRun $run): string
    {
        return Csv::render(self::HEADER, self::rows($run));
    }

    /**
     * People left out of the file, or in it with a gap, and why.
     *
     * @return list<array{code:string,name:string,reason:string}>
     */
    public static function skipped(PayrollRun $run): array
    {
        $out = [];
        foreach (PayrollItem::with('employee')->where('run_id', $run->id)->get()->sortBy(fn ($i) => $i->employee?->code) as $i) {
            $reason = match (true) {
                (bool) $i->hold => 'On hold'.($i->hold_reason ? ': '.$i->hold_reason : ''),
                (int) $i->net < 0 => 'Net pay is below zero',
                (int) $i->net === 0 => 'Net pay is zero',
                ! $i->bank_account_id => 'In the file, but no bank account on record',
                default => null,
            };
            if ($reason) {
                $out[] = ['code' => $i->employee?->code ?? '', 'name' => $i->employee?->name ?? '', 'reason' => $reason];
            }
        }

        return $out;
    }
}
