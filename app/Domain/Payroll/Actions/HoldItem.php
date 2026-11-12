<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

/** Hold / release one item (HR, open runs only). Held items are left out of totals and the bank file. */
class HoldItem
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(PayrollItem $item, bool $hold, ?string $reason, Employee $by): PayrollItem
    {
        return DB::transaction(function () use ($item, $hold, $reason, $by) {
            $run = PayrollRun::lockForUpdate()->findOrFail($item->run_id);
            RunBuilder::assertOpen($run);
            $reason = trim((string) $reason);
            if ($hold && $reason === '') {
                Fail::with('Give a reason for holding this salary.');
            }
            $item->update(['hold' => $hold, 'hold_reason' => $hold ? $reason : null]);
            $name = $item->employee?->name ?? 'an employee';
            $this->builder->log($run, $by, $hold ? "held the salary of {$name} ({$reason})" : "released the salary of {$name}", ['item_id' => $item->id]);

            return $item;
        });
    }
}
