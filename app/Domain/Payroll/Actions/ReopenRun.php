<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\PfLedger;
use Illuminate\Support\Facades\DB;

/** Management sends an approved (not paid) run back to review; the snapshot and PF ledger rows are released. */
class ReopenRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollRun $run, string $reason, Employee $by): PayrollRun
    {
        return DB::transaction(function () use ($run, $reason, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'approved') {
                Fail::with('Only approved runs that are not paid can be reopened.');
            }
            $reason = trim($reason);
            if ($reason === '') {
                Fail::with('Give a reason for reopening the run.');
            }
            $run->update([
                'status' => 'review', 'locked_at' => null, 'approved_at' => null, 'approved_by' => null,
                'reopened_at' => now(), 'reopened_by' => $by->id, 'reopen_reason' => $reason,
            ]);
            PfLedger::where('run_id', $run->id)->delete();
            PayrollItem::where('run_id', $run->id)->update(['snapshot_at' => null]);
            $this->builder->log($run, $by, "reopened the run ({$reason})");

            return $run;
        });
    }
}
