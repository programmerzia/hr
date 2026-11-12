<?php

namespace App\Domain\Payroll\Services;

use App\Models\BankAccount;
use App\Models\Department;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use Barryvdh\DomPDF\Facade\Pdf;

/** Renders the one-page payslip PDF from the item snapshot and stores it under storage/app/payslips/{run}/{code}.pdf. */
final class PayslipPdf
{
    /** Renders, stores and returns the path relative to storage/app. Also saves it on the item. */
    public static function render(PayrollItem $item): string
    {
        $run = PayrollRun::findOrFail($item->run_id);
        $emp = $item->employee()->firstOrFail();
        $adjustments = PayrollAdjustment::where('item_id', $item->id)->orderBy('created_at')->get();
        $bank = $item->bank_account_id ? BankAccount::find($item->bank_account_id) : null;
        $policy = $item->payroll_policy_id ? PayrollPolicy::find($item->payroll_policy_id) : null;

        $bonuses = $adjustments->where('kind', 'bonus');
        $earnings = $item->gross + $item->overtime_pay + (int) $bonuses->sum('amount');

        $pdf = Pdf::loadView('pdf.payslip', [
            'company' => config('app.name'),
            'run' => $run,
            'item' => $item,
            'employee' => $emp,
            'department' => $emp->department_id ? Department::whereKey($emp->department_id)->value('name') : null,
            'label' => PayrollPeriod::label($run->year, $run->month),
            'bonuses' => $bonuses,
            'deductionAdjustments' => $adjustments->where('kind', 'deduction'),
            'totalEarnings' => $earnings,
            'totalDeductions' => $earnings - $item->net,
            'showPf' => (bool) $policy?->pf_enabled || $item->pf > 0,
            'showLate' => (bool) $policy?->late_penalty_enabled || $item->late_deduction > 0,
            'showTax' => (bool) ($policy?->tax_enabled ?? true) || $item->tax > 0,
            'showLop' => (bool) ($policy?->lop_enabled ?? true) || $item->unpaid_deduction > 0,
            'bankMasked' => $bank ? self::mask($bank->account_no) : null,
            'bank' => $bank,
        ])->setPaper('a4');

        $relative = sprintf('payslips/%s/%s.pdf', $run->id, preg_replace('/[^A-Za-z0-9_-]/', '_', (string) ($emp->code ?: $emp->id)));
        $full = storage_path('app/'.$relative);
        if (! is_dir(dirname($full))) {
            mkdir(dirname($full), 0750, true);
        }
        file_put_contents($full, $pdf->output());
        $item->forceFill(['payslip_path' => $relative])->save();

        return $relative;
    }

    /** Absolute path of the stored PDF, rendering it first when missing. */
    public static function ensure(PayrollItem $item): string
    {
        $path = $item->payslip_path ? storage_path('app/'.$item->payslip_path) : null;
        if (! $path || ! is_file($path)) {
            $path = storage_path('app/'.self::render($item));
        }

        return $path;
    }

    public static function mask(string $account): string
    {
        $tail = substr(preg_replace('/\s+/', '', $account), -4);

        return str_repeat('*', 6).$tail;
    }
}
