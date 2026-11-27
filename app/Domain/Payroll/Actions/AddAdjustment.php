<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\MakerChecker;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class AddAdjustment
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollItem $item, string $category, ?string $label, float $amount, ?string $reason, Employee $by): PayrollAdjustment
    {
        return DB::transaction(function () use ($item, $category, $label, $amount, $reason, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($item->run_id);
            RunBuilder::assertOpen($run);
            if (! isset(PayrollAdjustment::CATEGORIES[$category])) {
                Fail::with('Choose what kind of adjustment this is.');
            }
            $reason = trim((string) $reason);
            if ($reason === '') {
                Fail::with('Give a reason for this adjustment.');
            }
            if (! ($amount > 0)) {
                Fail::with('Enter an amount greater than zero.');
            }
            $label = trim((string) $label) ?: PayrollAdjustment::categoryLabel($category);
            $adj = $this->builder->adjustment($item, $category, $label, (int) round($amount), $reason, $by);
            $this->builder->repriceAfterAdjustment($run, $item);
            MakerChecker::noteChange($run, $by);
            $this->builder->log($run, $by, sprintf('added %s "%s" for %s (%s)', PayrollAdjustment::categoryLabel($category), $adj->label, $item->employee?->name ?? 'an employee', $reason), [
                'item_id' => $item->id, 'amount' => $adj->amount,
            ]);

            return $adj;
        });
    }
}
