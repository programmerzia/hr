<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\Entitlement;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveType;

/** Creates the missing balance rows of an employee for a year (pro-rated; contractors get 0 entitled). */
class ProvisionBalances
{
    /** @return int rows created */
    public function __invoke(Employee $employee, int $year): int
    {
        $created = 0;
        foreach (LeaveType::all() as $type) {
            if (BalanceService::isUnlimited($type) || (float) $type->annual_quota <= 0) {
                continue;
            }
            $row = LeaveBalance::firstOrCreate(
                ['employee_id' => $employee->id, 'leave_type_id' => $type->id, 'year' => $year],
                [
                    'entitled' => $employee->employment_type === 'contractor' ? 0 : Entitlement::prorated($type, $employee->joined_on, $year),
                    'used' => 0, 'pending' => 0,
                ],
            );
            $created += $row->wasRecentlyCreated ? 1 : 0;
        }

        return $created;
    }
}
