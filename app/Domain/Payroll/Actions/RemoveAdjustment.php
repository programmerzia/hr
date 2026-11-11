<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class RemoveAdjustment
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollAdjustment $adjustment, Employee $by): void
    {
        DB::transaction(function () use ($adjustment, $by) {
            $item = $adjustment->item()->with('employee')->firstOrFail();
            $run = PayrollRun::lockForUpdate()->findOrFail($item->run_id);
            if (! in_array($run->status, ['draft', 'review'], true)) {
                Fail::with('This run is locked.');
            }
            $adjustment->delete();
            $this->builder->reprice($item->refresh());
            $this->builder->log($run, $by, sprintf('removed %s "%s" for %s', $adjustment->kind, $adjustment->label, $item->employee?->name ?? 'an employee'), [
                'item_id' => $item->id, 'amount' => $adjustment->amount,
            ]);
        });
    }
}
