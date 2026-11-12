<?php

namespace App\Domain\Payroll\Actions;

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

    public function __invoke(PayrollItem $item, string $kind, string $label, float $amount, ?string $note, Employee $by): PayrollAdjustment
    {
        return DB::transaction(function () use ($item, $kind, $label, $amount, $note, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($item->run_id);
            RunBuilder::assertOpen($run);
            if (trim($label) === '') {
                Fail::with('Add a label.');
            }
            if (! ($amount > 0)) {
                Fail::with('Enter an amount greater than zero.');
            }
            $note = trim((string) $note) ?: null;
            $adj = $this->builder->adjustment($item, $kind, $label, (int) round($amount), $note, $by);
            $this->builder->reprice($item->refresh());
            $this->builder->log($run, $by, sprintf('added %s "%s" for %s', $kind, $adj->label, $item->employee?->name ?? 'an employee'), [
                'item_id' => $item->id, 'amount' => $adj->amount,
            ]);

            return $adj;
        });
    }
}
