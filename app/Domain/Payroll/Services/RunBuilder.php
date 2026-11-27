<?php

namespace App\Domain\Payroll\Services;

use App\Domain\Leave\Services\Encashment;
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
        if ($run->kind === 'festival') {
            return $this->priceFestival($run, $emp, $adjustments, $attendance, $money);
        }
        $facts = PayrollFacts::for($emp, $run->year, $run->month, $attendance, $money);
        if ($facts['slices'] === []) {
            return null;
        }
        $values = [
            ...PayrollCalculator::compute($money, $facts['slices'], $facts, $adjustments),
            'payroll_policy_id' => $money->id,
            'attendance_policy_id' => $attendance->id,
        ];
        if ($run->kind === 'settlement') {
            $values = $this->withEncashment($values, $emp, $run->year);
        }

        return $values;
    }

    /** Settlement: unused encashable leave (exit year) at the daily rate is added to net. */
    private function withEncashment(array $values, Employee $emp, int $year): array
    {
        $enc = Encashment::for($emp, $year);
        $daily = (float) ($values['components']['daily_rate'] ?? 0);
        $amount = (int) round($enc['days'] * $daily);
        $values['leave_encashment'] = $amount;
        $values['net'] += $amount;
        $values['components'] = [...$values['components'], 'encashment_days' => $enc['days'], 'encashment_by_type' => $enc['by_type']];

        return $values;
    }

    /** Festival bonus: round(basic x pct / 100) from the structure in force at month end. No LOP, late, PF or tax. */
    private function priceFestival(PayrollRun $run, Employee $emp, array $adjustments, AttendancePolicy $attendance, PayrollPolicy $money): ?array
    {
        $structure = PayrollPeriod::salaryOn($emp->id, PayrollPeriod::end($run->year, $run->month));
        if (! $structure) {
            return null;
        }
        $pct = (float) $run->bonus_percent_of_basic;
        $gross = (int) round($structure->basic * $pct / 100);
        $adj = PayrollCalculator::adjustmentTotals($adjustments);

        return [
            'salary_structure_id' => $structure->id,
            'standard_minutes' => 0, 'worked_minutes' => 0, 'overtime_minutes' => 0, 'late_count' => 0,
            'eligible_days' => 0, 'absent_days' => 0, 'half_days' => 0, 'paid_leave_days' => 0, 'holiday_days' => 0,
            'unpaid_leave_days' => 0, 'day_fraction_total' => 0, 'lop_days' => 0, 'late_penalty_days' => 0,
            'gross' => $gross, 'overtime_pay' => 0, 'unpaid_deduction' => 0, 'late_deduction' => 0,
            'tax' => 0, 'pf' => 0, 'pf_employer' => 0, 'leave_encashment' => 0,
            'net' => $gross + $adj['bonus'] - $adj['deduction'],
            'components' => ['basic' => (int) $structure->basic, 'bonus_percent' => $pct, 'house_rent' => 0, 'medical' => 0, 'conveyance' => 0, 'other_allowances' => []],
            'slices' => [],
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

    /**
     * Eligible people get an item from fresh attendance and leave facts; people no longer eligible lose theirs.
     * Regular runs skip anyone with a settlement run for the month.
     *
     * @return list<string> names skipped because a settlement run exists
     */
    public function recompute(PayrollRun $run): array
    {
        $keep = [];
        $skipped = [];
        [$attendance, $money] = $this->policies($run);
        $settled = $run->kind === 'regular'
            ? PayrollRun::where('kind', 'settlement')->where('year', $run->year)->where('month', $run->month)->pluck('employee_id')->all()
            : [];
        $people = $run->kind === 'settlement'
            ? Employee::whereKey($run->employee_id)->get()
            : PayrollPeriod::eligible($run->year, $run->month);
        foreach ($people as $emp) {
            if (in_array($emp->id, $settled, true)) {
                $skipped[] = $emp->name;

                continue;
            }
            $existing = PayrollItem::where('run_id', $run->id)->where('employee_id', $emp->id)->first();
            $values = $this->price($run, $emp, $existing ? $this->adjustmentRows($existing) : [], $attendance, $money);
            if (! $values) {
                continue;
            }
            $item = $existing ?? new PayrollItem(['run_id' => $run->id, 'employee_id' => $emp->id, 'payslip_path' => null]);
            $item->fill([...$values, 'bank_account_id' => $emp->bankAccounts()->where('is_primary', true)->value('id')])->save();
            $keep[] = $item->id;
        }
        $dropped = PayrollItem::where('run_id', $run->id)->whereNotIn('id', $keep)->get();
        $blocked = $dropped->filter(fn (PayrollItem $i) => PayrollAdjustment::where('item_id', $i->id)->exists());
        if ($blocked->isNotEmpty()) {
            Fail::with('Recompute would drop people who have adjustments: '.$blocked->map(fn ($i) => $i->employee?->name ?? 'an employee')->implode(', ').'. Remove their adjustments first.');
        }
        $dropped->each->delete();
        // Facts changed: acknowledgements are void. Runs already in review are re-checked straight away.
        if ($run->status === 'review') {
            app(VarianceCheck::class)->apply($run);
        } else {
            PayrollItem::where('run_id', $run->id)->update(['variance_flag' => false, 'variance_kind' => 'none', 'variance_pct' => null, 'variance_ack_by' => null, 'variance_ack_at' => null]);
        }

        return $skipped;
    }

    /** Writes the "left out of this run" note for people covered by a settlement run. */
    public function logSkipped(PayrollRun $run, Employee $actor, array $skipped): void
    {
        if ($skipped !== []) {
            $this->log($run, $actor, 'left out (final settlement run exists): '.implode(', ', $skipped));
        }
    }

    public function adjustment(PayrollItem $item, string $category, string $label, int $amount, ?string $note, Employee $by, ?string $source = null, ?string $sourceRef = null): PayrollAdjustment
    {
        return PayrollAdjustment::create([
            'item_id' => $item->id, 'category' => $category, 'kind' => PayrollAdjustment::kindOf($category),
            'label' => trim($label), 'amount' => $amount, 'note' => $note, 'created_by' => $by->id,
            'source' => $source, 'source_ref' => $sourceRef,
        ]);
    }

    /** Net of every non-held item that is below zero (BankAdvice cannot pay these). @return list<string> names */
    public function negativeNames(PayrollRun $run): array
    {
        return PayrollItem::with('employee')->where('run_id', $run->id)->where('hold', false)->where('net', '<', 0)->get()
            ->map(fn ($i) => ($i->employee?->name ?? 'An employee').' ('.number_format((int) $i->net).')')->all();
    }

    /**
     * Salary held in the last paid regular run is paid with this one: an arrears adjustment per held item.
     * Idempotent per held item.
     *
     * @return list<string> names whose held salary could not be carried (not in this run)
     */
    public function carryHeld(PayrollRun $run, Employee $by): array
    {
        $prev = PayrollRun::where('kind', 'regular')->where('status', 'paid')
            ->where(fn ($q) => $q->where('year', '<', $run->year)->orWhere(fn ($q) => $q->where('year', $run->year)->where('month', '<', $run->month)))
            ->orderByDesc('year')->orderByDesc('month')->first();
        if (! $prev) {
            return [];
        }
        $missed = [];
        $label = PayrollPeriod::label($prev->year, $prev->month);
        foreach (PayrollItem::with('employee')->where('run_id', $prev->id)->where('hold', true)->where('net', '>', 0)->get() as $held) {
            $mine = PayrollItem::where('run_id', $run->id)->where('employee_id', $held->employee_id)->first();
            if (! $mine) {
                $missed[] = $held->employee?->name ?? 'an employee';

                continue;
            }
            if (PayrollAdjustment::withTrashed()->where('item_id', $mine->id)->where('source', 'carried_hold')->where('source_ref', $held->id)->exists()) {
                continue;
            }
            $this->adjustment($mine, 'arrears', "Held salary, {$label}", (int) $held->net, 'Held in the '.$label.' run: '.($held->hold_reason ?: 'no reason recorded'), $by, 'carried_hold', $held->id);
            $this->reprice($mine->refresh());
            $this->log($run, $by, 'carried held salary of '.($held->employee?->name ?? 'an employee')." from {$label}", ['item_id' => $mine->id, 'amount' => (int) $held->net]);
        }

        return $missed;
    }

    /** Reprice after an adjustment change; a run in review is re-checked for variance so stale acknowledgements fall away. */
    public function repriceAfterAdjustment(PayrollRun $run, PayrollItem $item): void
    {
        $this->reprice($item->refresh());
        if ($run->status === 'review') {
            app(VarianceCheck::class)->applyTo($run, $item->refresh());
        }
    }
}
