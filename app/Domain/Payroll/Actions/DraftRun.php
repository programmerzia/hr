<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollRun;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class DraftRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(int $year, int $month, Employee $by): PayrollRun
    {
        $exists = 'A run for '.PayrollPeriod::label($year, $month).' already exists.';

        return DB::transaction(function () use ($year, $month, $by, $exists) {
            if (PayrollRun::where('year', $year)->where('month', $month)->lockForUpdate()->exists()) {
                Fail::with($exists);
            }
            try {
                $run = PayrollRun::create(['year' => $year, 'month' => $month, 'status' => 'draft']);
            } catch (UniqueConstraintViolationException) {
                Fail::with($exists);
            }
            $this->builder->recompute($run);
            $this->builder->log($run, $by, 'started the run');

            return $run;
        });
    }
}
