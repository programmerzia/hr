<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Models\Employee;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class Recompute
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollRun $run, Employee $by): PayrollRun
    {
        return DB::transaction(function () use ($run, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            RunBuilder::assertOpen($run, 'Approved runs are locked and cannot be recomputed.');
            $skipped = $this->builder->recompute($run);
            $this->builder->log($run, $by, 'recomputed the run from attendance and leave');
            $this->builder->logSkipped($run, $by, $skipped);

            return $run;
        });
    }
}
