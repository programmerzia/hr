<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

/** HR acknowledges a flagged item while the run is in review. */
class AckVariance
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollItem $item, Employee $by): PayrollItem
    {
        return DB::transaction(function () use ($item, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($item->run_id);
            if ($run->status !== 'review') {
                Fail::with('Variance flags can only be acknowledged while the run is in review.');
            }
            if (! $item->variance_flag) {
                Fail::with('This item is not flagged.');
            }
            $item->update(['variance_ack_by' => $by->id, 'variance_ack_at' => now()]);
            $this->builder->log($run, $by, 'acknowledged the variance for '.($item->employee?->name ?? 'an employee'), ['item_id' => $item->id]);

            return $item;
        });
    }
}
