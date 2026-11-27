<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\Entitlement;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * After a leave type's quota changes, moves current-year and later balance rows from the old entitlement to the new
 * one. A row whose entitled differs from the old computed entitlement was edited by hand and is left alone.
 */
class ReprorateBalances
{
    /** @return int rows updated */
    public function __invoke(LeaveType $type, float $oldQuota): int
    {
        $old = $type->replicate();
        $old->annual_quota = $oldQuota;
        $updated = 0;
        DB::transaction(function () use ($type, $old, &$updated) {
            $rows = LeaveBalance::where('leave_type_id', $type->id)->where('year', '>=', (int) now()->format('Y'))->lockForUpdate()->get();
            $employees = Employee::whereIn('id', $rows->pluck('employee_id')->unique())->get()->keyBy('id');
            foreach ($rows as $row) {
                $emp = $employees[$row->employee_id] ?? null;
                if (! $emp) {
                    continue;
                }
                $contractor = $emp->employment_type === 'contractor';
                $was = $contractor ? 0.0 : Entitlement::prorated($old, $emp->joined_on, (int) $row->year);
                $now = $contractor ? 0.0 : Entitlement::prorated($type, $emp->joined_on, (int) $row->year);
                if (abs((float) $row->entitled - $was) < 0.001 && abs($was - $now) >= 0.001) {
                    $row->update(['entitled' => $now]);
                    $updated++;
                }
            }
        });

        Audit::log($type, "Quota changed from {$oldQuota} to {$type->annual_quota}; {$updated} balances re-prorated", null, ['old' => $oldQuota, 'new' => (float) $type->annual_quota, 'rows' => $updated]);

        return $updated;
    }
}
