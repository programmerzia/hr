<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

/** Deletes a draft run that was started by mistake (nothing has been reviewed, approved or paid). */
class DiscardRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollRun $run, Employee $by): void
    {
        DB::transaction(function () use ($run, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($run->id);
            if ($run->status !== 'draft' || $run->locked_at) {
                Fail::with('Only draft runs can be discarded.');
            }
            $title = PayrollPeriod::label($run->year, $run->month);
            $run->delete(); // items and adjustments cascade
            ActivityLogEntry::create([
                'subject_type' => 'payroll', 'subject_id' => $run->id, 'actor_id' => $by->id,
                'description' => "discarded the draft run for {$title}",
            ]);
        });
    }
}
