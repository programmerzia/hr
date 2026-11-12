<?php

namespace App\Domain\Payroll\Support;

use App\Domain\Payroll\Services\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollPeriod;
use App\Http\Resources\ActivityLogEntryResource;
use App\Http\Resources\PayrollAdjustmentResource;
use App\Http\Resources\PayrollItemResource;
use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use Illuminate\Support\Collection;

/** Prop shaping shared by the payroll controllers. */
final class Shape
{
    /** @param Collection<int,PayrollItem> $items @param Collection<int,PayrollAdjustment> $adjustments */
    public static function totals(Collection $items, Collection $adjustments): array
    {
        $held = $items->filter(fn ($i) => (bool) $i->hold)->count();
        $items = $items->reject(fn ($i) => (bool) $i->hold)->values();
        $adjustments = $adjustments->whereIn('item_id', $items->pluck('id'));
        $adj = PayrollCalculator::adjustmentTotals($adjustments->map->only(['kind', 'amount'])->all());

        return [
            'employees' => $items->count(),
            'gross' => (int) $items->sum('gross'),
            'adjustments' => $adj['bonus'],
            'deductions' => (int) $items->sum(fn ($i) => $i->unpaid_deduction + $i->late_deduction + $i->tax + $i->pf) + $adj['deduction'],
            'net' => (int) $items->sum('net'),
            'pf_employer' => (int) $items->sum('pf_employer'),
            'encashment' => (int) $items->sum('leave_encashment'),
            'held' => $held,
        ];
    }

    /** Deductions in one run split by type (values only; the page formats them). */
    public static function mix(Collection $items, Collection $adjustments): array
    {
        $items = $items->reject(fn ($i) => (bool) $i->hold)->values();
        $adjustments = $adjustments->whereIn('item_id', $items->pluck('id'));
        $manual = PayrollCalculator::adjustmentTotals($adjustments->map->only(['kind', 'amount'])->all())['deduction'];

        return [
            ['label' => 'Tax', 'value' => (int) $items->sum('tax'), 'color' => 'chart-1'],
            ['label' => 'Provident fund', 'value' => (int) $items->sum('pf'), 'color' => 'chart-2'],
            ['label' => 'Loss of pay', 'value' => (int) $items->sum('unpaid_deduction'), 'color' => 'chart-4'],
            ['label' => 'Late', 'value' => (int) $items->sum('late_deduction'), 'color' => 'chart-5'],
            ['label' => 'Adjustments', 'value' => $manual, 'color' => 'chart-3'],
        ];
    }

    /** Money switches that applied to the run (the snapshot policy, or the one in force at month end). */
    public static function policy(PayrollRun $run, Collection $items): array
    {
        $id = $items->pluck('payroll_policy_id')->filter()->first();
        $p = ($id ? PayrollPolicy::find($id) : null) ?? PayrollPolicy::forDate(PayrollPeriod::end($run->year, $run->month));

        return [
            'id' => $p->id, 'daily_rate_basis' => $p->daily_rate_basis, 'lop_enabled' => (bool) $p->lop_enabled,
            'late_penalty_enabled' => (bool) $p->late_penalty_enabled, 'pf_enabled' => (bool) $p->pf_enabled,
            'tax_enabled' => (bool) $p->tax_enabled, 'overtime_enabled' => (bool) $p->overtime_enabled,
        ];
    }

    public static function item(PayrollItem $item): array
    {
        return PayrollItemResource::make($item)->resolve();
    }

    public static function adjustments(iterable $list): array
    {
        return PayrollAdjustmentResource::collection(collect($list))->resolve();
    }

    /** Run history, newest first. */
    public static function events(string $runId): array
    {
        return ActivityLogEntryResource::collection(
            ActivityLogEntry::where('subject_type', 'payroll_run')->where('subject_id', $runId)->orderByDesc('created_at')->orderByDesc('id')->get(),
        )->resolve();
    }

    /** Names for lists. @param iterable<string> $ids */
    public static function people(iterable $ids): array
    {
        return Employee::whereIn('id', collect($ids)->filter()->unique()->values())->orderBy('name')->get()
            ->map(fn ($e) => $e->only(['id', 'name', 'code', 'designation', 'department_id', 'joined_on']))
            ->map(fn ($e) => [...$e, 'joined_on' => $e['joined_on']?->format('Y-m-d')])->all();
    }
}
