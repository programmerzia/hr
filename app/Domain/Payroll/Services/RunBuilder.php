<?php

namespace App\Domain\Payroll\Services;

use App\Domain\Payroll\Support\Fail;
use App\Models\ActivityLogEntry;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;

/** Builds and prices payroll items from PayrollFacts + PayrollCalculator (docs/07 §4). */
class RunBuilder
{
    public function log(PayrollRun $run, Employee $actor, string $text, array $properties = []): ActivityLogEntry
    {
        return ActivityLogEntry::create([
            'subject_type' => 'payroll_run', 'subject_id' => $run->id, 'actor_id' => $actor->id,
            'description' => $text, 'properties' => $properties ?: null,
        ]);
    }

    /** Fails with the module's validation error unless the run is open (draft/review) and not locked. */
    public static function assertOpen(PayrollRun $run, string $message = 'This run is locked.'): void
    {
        if (! $run->isOpen()) {
            Fail::with($message);
        }
    }

    /** @return list<array{kind:string,amount:int}> */
    public function adjustmentRows(PayrollItem $item): array
    {
        return PayrollAdjustment::where('item_id', $item->id)->get(['kind', 'amount'])->map(fn ($a) => ['kind' => $a->kind, 'amount' => (int) $a->amount])->all();
    }

    /** @return array{0:AttendancePolicy,1:PayrollPolicy} policies in force at the end of the run month */
    public function policies(PayrollRun $run): array
    {
        $end = PayrollPeriod::end($run->year, $run->month);

        return [AttendancePolicy::forDate($end), PayrollPolicy::forDate($end)];
    }

    /** Facts + money for one employee. @return array<string,mixed>|null null when there is no salary in the window */
    public function price(PayrollRun $run, Employee $emp, array $adjustments, ?AttendancePolicy $attendance = null, ?PayrollPolicy $money = null): ?array
    {
        if (! $attendance || ! $money) {
            [$attendance, $money] = $this->policies($run);
        }
        $facts = PayrollFacts::for($emp, $run->year, $run->month, $attendance, $money);
        if ($facts['slices'] === []) {
            return null;
        }

        return [
            ...PayrollCalculator::compute($money, $facts['slices'], $facts, $adjustments),
            'payroll_policy_id' => $money->id,
            'attendance_policy_id' => $attendance->id,
        ];
    }

    /** Recalculates one item (after adjustments change) from fresh facts. */
    public function reprice(PayrollItem $item): void
    {
        $run = PayrollRun::findOrFail($item->run_id);
        $emp = Employee::find($item->employee_id);
        $values = $emp ? $this->price($run, $emp, $this->adjustmentRows($item)) : null;
        if ($values) {
            $item->update($values);
        }
    }

    /** Eligible people get an item from fresh attendance and leave facts; people no longer eligible lose theirs. */
    public function recompute(PayrollRun $run): void
    {
        $keep = [];
        [$attendance, $money] = $this->policies($run);
        foreach (PayrollPeriod::eligible($run->year, $run->month) as $emp) {
            $existing = PayrollItem::where('run_id', $run->id)->where('employee_id', $emp->id)->first();
            $values = $this->price($run, $emp, $existing ? $this->adjustmentRows($existing) : [], $attendance, $money);
            if (! $values) {
                continue;
            }
            $item = $existing ?? new PayrollItem(['run_id' => $run->id, 'employee_id' => $emp->id, 'payslip_path' => null]);
            $item->fill([...$values, 'bank_account_id' => $emp->bankAccounts()->where('is_primary', true)->value('id')])->save();
            $keep[] = $item->id;
        }
        PayrollItem::where('run_id', $run->id)->whereNotIn('id', $keep)->get()->each->delete();
        // Facts changed: acknowledgements are void. Runs already in review are re-checked straight away.
        if ($run->status === 'review') {
            app(VarianceCheck::class)->apply($run);
        } else {
            PayrollItem::where('run_id', $run->id)->update(['variance_flag' => false, 'variance_kind' => 'none', 'variance_pct' => null, 'variance_ack_by' => null, 'variance_ack_at' => null]);
        }
    }

    public function adjustment(PayrollItem $item, string $kind, string $label, int $amount, ?string $note, Employee $by): PayrollAdjustment
    {
        return PayrollAdjustment::create([
            'item_id' => $item->id,
            'kind' => $kind, 'label' => trim($label), 'amount' => $amount, 'note' => $note, 'created_by' => $by->id,
        ]);
    }
}
