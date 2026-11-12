<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Domain\Payroll\Support\PayrollNotification;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\PfLedger;
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
            $this->snapshot($run, $at);
            $this->builder->log($run, $by, 'approved and locked the run');
            $label = PayrollPeriod::label($run->year, $run->month);
            $n = new PayrollNotification("Payroll for {$label} approved", "{$by->name} approved and locked the run. Mark it as paid after the bank transfer.", "/payroll/{$run->id}");
            User::where('role', 'hr')->get()->each->notify($n);

            return $run;
        });
    }

    /** Freeze every item (components, slices and policy ids are already on it) and write PF ledger rows. */
    private function snapshot(PayrollRun $run, $at): void
    {
        $items = PayrollItem::where('run_id', $run->id)->get();
        PayrollItem::where('run_id', $run->id)->update(['snapshot_at' => $at]);
        PfLedger::where('run_id', $run->id)->delete();
        foreach ($items as $item) {
            $policy = $item->payroll_policy_id ? PayrollPolicy::find($item->payroll_policy_id) : null;
            if (! $policy?->pf_enabled || $item->hold || ($item->pf <= 0 && $item->pf_employer <= 0)) {
                continue;
            }
            $prior = PfLedger::where('employee_id', $item->employee_id)
                ->where(fn ($q) => $q->where('year', '<', $run->year)->orWhere(fn ($q) => $q->where('year', $run->year)->where('month', '<=', $run->month)))
                ->orderByDesc('year')->orderByDesc('month')->orderByDesc('created_at')->first();
            PfLedger::create([
                'item_id' => $item->id, 'run_id' => $run->id, 'employee_id' => $item->employee_id,
                'year' => $run->year, 'month' => $run->month,
                'employee_amount' => $item->pf, 'employer_amount' => $item->pf_employer,
                'cumulative_employee' => ($prior->cumulative_employee ?? 0) + $item->pf,
                'cumulative_employer' => ($prior->cumulative_employer ?? 0) + $item->pf_employer,
            ]);
        }
    }
}
