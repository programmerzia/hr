<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
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
            PayrollItem::with('employee')->where('run_id', $run->id)->get()->each(fn ($i) => $i->update([
                'payslip_path' => sprintf('payslips/%s-%d-%02d.pdf', $i->employee?->code ?? $i->employee_id, $run->year, $run->month),
            ]));
            $this->builder->log($run, $by, "marked the run as paid ({$reference})");

            return $run;
        });
    }
}
