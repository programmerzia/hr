<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\Entitlement;
use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveType;

/**
 * Opens year+1 balances for every active employee: full quota plus carried_in = min(unused, cap) for carry-forward
 * types. unused = entitled + carried_in - used (pending ignored). Idempotent: existing rows are never touched.
 */
class RolloverYear
{
    /** @return array{created: int, skipped: int} */
    public function __invoke(int $fromYear): array
    {
        $to = $fromYear + 1;
        $created = $skipped = 0;
        $types = LeaveType::all()->reject(fn ($t) => BalanceService::isUnlimited($t) || (float) $t->annual_quota <= 0);
        $employees = Employee::query()->whereNotIn('status', ['resigned', 'terminated'])->get();
        foreach ($employees as $employee) {
            $contractor = $employee->employment_type === 'contractor';
            foreach ($types as $type) {
                $key = ['employee_id' => $employee->id, 'leave_type_id' => $type->id, 'year' => $to];
                if (LeaveBalance::where($key)->exists()) {
                    $skipped++;

                    continue;
                }
                $carried = 0.0;
                if (! $contractor && $type->carry_forward) {
                    $prev = LeaveBalance::where([...$key, 'year' => $fromYear])->first();
                    $entitled = $prev ? (float) $prev->entitled : Entitlement::prorated($type, $employee->joined_on, $fromYear);
                    $unused = max(0.0, $entitled + (float) ($prev->carried_in ?? 0) - (float) ($prev->used ?? 0));
                    $cap = $type->carry_forward_cap;
                    $carried = $cap === null ? $unused : min($unused, (float) $cap);
                }
                LeaveBalance::create([...$key, 'entitled' => $contractor ? 0 : $type->annual_quota, 'carried_in' => $carried, 'used' => 0, 'pending' => 0]);
                $created++;
            }
        }
        ActivityLogEntry::create([
            'subject_type' => 'leave_rollover', 'subject_id' => (string) $to, 'actor_id' => null,
            'description' => "Leave rollover {$fromYear} to {$to}: {$created} balances created, {$skipped} already existed",
            'properties' => ['from' => $fromYear, 'to' => $to, 'created' => $created, 'skipped' => $skipped],
        ]);

        return ['created' => $created, 'skipped' => $skipped];
    }
}
