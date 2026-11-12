<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Services\VarianceCheck;
use App\Domain\Payroll\Support\Fail;
use App\Domain\Payroll\Support\PayrollNotification;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SubmitForReview
{
    public function __construct(private RunBuilder $builder, private VarianceCheck $variance) {}

    public function __invoke(PayrollRun $run, Employee $by): PayrollRun
    {
        return DB::transaction(function () use ($run, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'draft') {
                Fail::with('Only draft runs can be sent for review.');
            }
            if (! PayrollItem::where('run_id', $run->id)->exists()) {
                Fail::with('This run has no employees.');
            }
            $run->update(['status' => 'review']);
            $this->variance->apply($run);
            $this->builder->log($run, $by, 'sent the run for review');
            $label = PayrollPeriod::label($run->year, $run->month);
            $n = new PayrollNotification("Payroll for {$label} is ready for review", "{$by->name} sent the run for approval.", "/payroll/{$run->id}");
            User::where('role', 'management')->get()->each->notify($n);

            return $run;
        });
    }
}
