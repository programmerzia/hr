<?php

namespace App\Domain\Payroll\Services;

use App\Models\PayrollItem;
use App\Models\PayrollRun;

/** Flags items whose net moved more than 20% against the employee's last paid regular run. Clears acknowledgements. */
class VarianceCheck
{
    public const THRESHOLD = 0.20;

    public function apply(PayrollRun $run): void
    {
        foreach (PayrollItem::where('run_id', $run->id)->get() as $item) {
            $item->update($this->assess($run, $item));
        }
    }

    /** Re-checks one item (a salary released from hold while the run is in review). */
    public function applyTo(PayrollRun $run, PayrollItem $item): void
    {
        $item->update($this->assess($run, $item));
    }

    /** @return array<string,mixed> */
    private function assess(PayrollRun $run, PayrollItem $item): array
    {
        $clear = ['variance_flag' => false, 'variance_kind' => 'none', 'variance_pct' => null, 'variance_ack_by' => null, 'variance_ack_at' => null];
        if ($item->hold || $run->kind !== 'regular') {
            return $clear;
        }
        $prev = PayrollItem::query()
            ->join('payroll_runs', 'payroll_runs.id', '=', 'payroll_items.run_id')
            ->where('payroll_items.employee_id', $item->employee_id)
            ->where('payroll_runs.status', 'paid')->where('payroll_runs.kind', 'regular')
            ->where('payroll_items.hold', false)
            ->where(fn ($q) => $q->where('payroll_runs.year', '<', $run->year)
                ->orWhere(fn ($q) => $q->where('payroll_runs.year', $run->year)->where('payroll_runs.month', '<', $run->month)))
            ->orderByDesc('payroll_runs.year')->orderByDesc('payroll_runs.month')
            ->value('payroll_items.net');

        if ($prev === null || (int) $prev <= 0) {
            return $item->net > 0 ? [...$clear, 'variance_flag' => true, 'variance_kind' => 'new'] : $clear;
        }
        $change = ($item->net - $prev) / $prev;
        if (abs($change) <= self::THRESHOLD) {
            return $clear;
        }

        return [...$clear, 'variance_flag' => true, 'variance_kind' => $change > 0 ? 'up' : 'down', 'variance_pct' => round($change * 100, 2)];
    }
}
