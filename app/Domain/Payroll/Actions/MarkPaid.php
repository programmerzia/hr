<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\PayslipPdf;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Domain\Payroll\Support\PayrollNotification;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MarkPaid
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollRun $run, string $paidOn, string $reference, Employee $by): PayrollRun
    {
        return DB::transaction(function () use ($run, $reference, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'approved') {
                Fail::with('Only approved runs can be marked as paid.');
            }
            $reference = trim($reference);
            $run->update(['status' => 'paid', 'paid_at' => now(), 'payment_reference' => $reference]);
            $this->builder->log($run, $by, "marked the run as paid ({$reference})");
            $this->payslipsAndNotices($run);

            return $run;
        });
    }

    /** Real PDFs for every item (a failed render is retried lazily on download), then the notifications. */
    private function payslipsAndNotices(PayrollRun $run): void
    {
        $label = PayrollPeriod::label($run->year, $run->month);
        $held = [];
        foreach (PayrollItem::with('employee')->where('run_id', $run->id)->get() as $item) {
            try {
                PayslipPdf::render($item);
            } catch (\Throwable $e) {
                report($e);
            }
            if ($item->hold) {
                $held[] = $item->employee?->name ?? 'an employee';

                continue;
            }
            User::where('employee_id', $item->employee_id)->get()->each->notify(
                new PayrollNotification("Your payslip for {$label} is ready", 'Payroll has been paid. Open your payslip.', '/payslips'),
            );
        }
        if ($held !== []) {
            $n = new PayrollNotification("Payroll for {$label} paid, ".count($held).' on hold', 'Not paid or notified: '.implode(', ', $held).'.', "/payroll/{$run->id}");
            User::where('role', 'hr')->get()->each->notify($n);
        }
    }
}
