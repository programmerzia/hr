<?php

namespace App\Domain\Payroll\Services;

use App\Models\ActivityLogEntry;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;

/** Builds and prices payroll items (buildItem / repriceItem / recomputeInto in the mock store). */
class RunBuilder
{
    public function calculator(): PayrollCalculator
    {
        return PayrollCalculator::fromPolicy(AttendancePolicy::current());
    }

    public function log(PayrollRun $run, Employee $actor, string $text, array $properties = []): ActivityLogEntry
    {
        return ActivityLogEntry::create([
            'subject_type' => 'payroll_run', 'subject_id' => $run->id, 'actor_id' => $actor->id,
            'description' => $text, 'properties' => $properties ?: null,
        ]);
    }

    /** @return list<array{kind:string,amount:int}> */
    public function adjustmentRows(PayrollItem $item): array
    {
        return PayrollAdjustment::where('item_id', $item->id)->get(['kind', 'amount'])->map(fn ($a) => ['kind' => $a->kind, 'amount' => (int) $a->amount])->all();
    }

    private function structureArray(SalaryStructure $s): array
    {
        return $s->only(['basic', 'gross', 'hourly_rate', 'pf_percent', 'tax_monthly']);
    }

    /** Recalculates money fields of one item from its stored facts (after adjustments change). */
    public function reprice(PayrollItem $item): void
    {
        $structure = SalaryStructure::find($item->salary_structure_id);
        if (! $structure) {
            return;
        }
        $std = (int) AttendancePolicy::current()->standard_minutes;
        $item->update($this->calculator()->calc([
            'structure' => $this->structureArray($structure),
            'working_days' => $item->standard_minutes / $std,
            'worked_minutes' => $item->worked_minutes,
            'unpaid_days' => (float) $item->unpaid_leave_days,
            'late_count' => $item->late_count,
            'adjustments' => $this->adjustmentRows($item),
        ]));
    }

    /** Eligible people get an item from fresh attendance and leave facts; people no longer eligible lose theirs. */
    public function recompute(PayrollRun $run): void
    {
        $keep = [];
        $calc = $this->calculator();
        $end = PayrollPeriod::end($run->year, $run->month);
        foreach (PayrollPeriod::eligible($run->year, $run->month) as $emp) {
            $structure = PayrollPeriod::salaryOn($emp->id, $end);
            if (! $structure) {
                continue;
            }
            $existing = PayrollItem::where('run_id', $run->id)->where('employee_id', $emp->id)->first();
            $facts = PayrollPeriod::facts($emp->id, $run->year, $run->month);
            $values = $calc->calc([
                'structure' => $this->structureArray($structure),
                ...$facts,
                'unpaid_days' => $facts['unpaid_days'],
                'adjustments' => $existing ? $this->adjustmentRows($existing) : [],
            ]);
            $attrs = [
                ...$values,
                'salary_structure_id' => $structure->id,
                'bank_account_id' => $emp->bankAccounts()->where('is_primary', true)->value('id'),
            ];
            $item = $existing ?? new PayrollItem(['run_id' => $run->id, 'employee_id' => $emp->id, 'payslip_path' => null]);
            $item->fill($attrs)->save();
            $keep[] = $item->id;
        }
        PayrollItem::where('run_id', $run->id)->whereNotIn('id', $keep)->get()->each->delete();
    }

    public function adjustment(PayrollItem $item, string $kind, string $label, int $amount, ?string $note, Employee $by): PayrollAdjustment
    {
        return PayrollAdjustment::create([
            'item_id' => $item->id,
            'kind' => $kind, 'label' => trim($label), 'amount' => $amount, 'note' => $note, 'created_by' => $by->id,
        ]);
    }
}
