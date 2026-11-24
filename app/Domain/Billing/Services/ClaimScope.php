<?php

namespace App\Domain\Billing\Services;

use App\Models\ContractorClaim;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Which claims a viewer can see, and which are waiting for them. Permission and team data only. */
final class ClaimScope
{
    /** @return Builder<ContractorClaim> */
    public static function visible(User $user): Builder
    {
        $q = ContractorClaim::query();
        if ($user->checkPermissionTo('view_company')) {
            return $q;
        }
        $own = $user->employee_id;
        if ($user->employee && $user->checkPermissionTo('verify_claims')) {
            return $q->whereIn('employee_id', array_unique([...$user->employee->ledEmployeeIds(), $own]));
        }

        return $q->where('employee_id', $own);
    }

    /** Claims the viewer can act on next: verify_claims verifies submitted, approve_claims approves verified, manage_payroll pays approved. */
    public static function awaiting(User $user): Builder
    {
        $own = $user->employee_id;
        $q = ContractorClaim::query()->where('employee_id', '!=', $own ?? '');

        return $q->where(function (Builder $w) use ($user, $own) {
            $w->whereRaw('1 = 0');
            if ($user->checkPermissionTo('verify_claims')) {
                $ids = $user->employee ? array_values(array_diff($user->employee->ledEmployeeIds(), [$own])) : [];
                $w->orWhere(function (Builder $x) use ($user, $ids) {
                    $x->where('status', 'submitted')->where(function (Builder $y) use ($user, $ids) {
                        $y->whereIn('employee_id', $ids);
                        if ($user->checkPermissionTo('view_company')) {
                            $y->orWhereIn('employee_id', self::leaderless());
                        }
                    });
                });
            }
            if ($user->checkPermissionTo('approve_claims')) {
                $w->orWhere('status', 'verified');
            }
            if ($user->checkPermissionTo('manage_payroll')) {
                $w->orWhere('status', 'approved');
            }
        });
    }

    /** Employees nobody leads: no team, or a team without a lead (or led by themselves). @return Builder<Employee> */
    private static function leaderless(): Builder
    {
        return Employee::query()->select('employees.id')->where(function (Builder $q) {
            $q->whereNull('team_id')
                ->orWhereHas('team', fn (Builder $t) => $t->whereNull('lead_employee_id')->orWhereColumn('teams.lead_employee_id', 'employees.id'));
        });
    }
}
