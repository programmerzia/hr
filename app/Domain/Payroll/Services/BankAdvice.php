<?php

namespace App\Domain\Payroll\Services;

use App\Models\BankAccount;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
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
        $h = fopen('php://temp', 'r+');
        fputcsv($h, self::HEADER, escape: '');
        foreach (self::rows($run) as $row) {
            // Account numbers stay text in spreadsheets; leading "=+-@" are neutralised against formula injection.
            fputcsv($h, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'".$v : $v, $row), escape: '');
        }
        rewind($h);
        $out = stream_get_contents($h);
        fclose($h);

        return (string) $out;
    }
}
