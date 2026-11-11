<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class DraftRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(int $year, int $month, Employee $by): PayrollRun
    {
        if (PayrollRun::where('year', $year)->where('month', $month)->exists()) {
            Fail::with('A run for '.PayrollPeriod::label($year, $month).' already exists.');
        }

        return DB::transaction(function () use ($year, $month, $by) {
            $run = PayrollRun::create(['year' => $year, 'month' => $month, 'status' => 'draft']);
            $this->builder->recompute($run);
            $this->builder->log($run, $by, 'started the run');

            return $run;
        });
    }
}
