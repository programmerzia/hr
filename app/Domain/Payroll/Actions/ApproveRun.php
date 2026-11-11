<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Domain\Payroll\Support\PayrollNotification;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ApproveRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollRun $run, Employee $by): PayrollRun
    {
        return DB::transaction(function () use ($run, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'review') {
                Fail::with('Only runs in review can be approved.');
            }
            $at = now();
            $run->update(['status' => 'approved', 'approved_by' => $by->id, 'approved_at' => $at, 'locked_at' => $at]);
            $this->builder->log($run, $by, 'approved and locked the run');
            $label = PayrollPeriod::label($run->year, $run->month);
            $n = new PayrollNotification("Payroll for {$label} approved", "{$by->name} approved and locked the run. Mark it as paid after the bank transfer.", "/payroll/{$run->id}");
            User::where('role', 'hr')->get()->each->notify($n);

            return $run;
        });
    }
}
