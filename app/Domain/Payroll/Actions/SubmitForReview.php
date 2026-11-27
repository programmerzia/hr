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

    public function __invoke(PayrollRun $run, Employee $by, bool $payEarly = false, ?string $earlyReason = null): PayrollRun
    {
        return DB::transaction(function () use ($run, $by, $payEarly, $earlyReason) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'draft') {
                Fail::with('Only draft runs can be sent for review.');
            }
            $earlyReason = trim((string) $earlyReason);
            $early = $run->kind === 'regular' && now()->toDateString() <= PayrollPeriod::end($run->year, $run->month);
            if ($early && (! $payEarly || $earlyReason === '')) {
                Fail::with(PayrollPeriod::label($run->year, $run->month).' has not ended yet, so days still to come would be paid in full. Wait for the month to end, or tick "Pay before month end" and give a reason.');
            }
            // Numbers go to review fresh, never as last computed.
            $skipped = $this->builder->recompute($run);
            if (! PayrollItem::where('run_id', $run->id)->exists()) {
                Fail::with('This run has no employees.');
            }
            $negative = $this->builder->negativeNames($run);
            if ($negative !== []) {
                Fail::with('Net pay is below zero for: '.implode(', ', $negative).'. Fix the adjustments or hold the salary before sending for review.');
            }
            $run->update([
                'status' => 'review', 'submitted_by' => $by->id, 'submitted_at' => now(),
                'review_editors' => null, 'early_pay_reason' => $early ? $earlyReason : null,
            ]);
            $this->variance->apply($run);
            $this->builder->log($run, $by, 'recomputed and sent the run for review');
            $this->builder->logSkipped($run, $by, $skipped);
            if ($early) {
                $this->builder->log($run, $by, "sent for review before the month ended ({$earlyReason})");
            }
            $label = PayrollPeriod::runTitle($run);
            $n = new PayrollNotification("Payroll for {$label} is ready for review", "{$by->name} sent the run for approval.", "/payroll/{$run->id}");
            User::permission('approve_payroll')->get()->reject(fn (User $u) => $u->employee_id === $by->id)->each->notify($n);

            return $run;
        });
    }
}
