<?php

namespace App\Domain\Billing\Services;

use App\Models\ContractorClaim;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Which claims a viewer can see, and which are waiting for them. */
final class ClaimScope
{
    /** @return Builder<ContractorClaim> */
    public static function visible(User $user): Builder
    {
        $q = ContractorClaim::query();
        if (in_array($user->role, ['management', 'hr'], true)) {
            return $q;
        }
        $own = $user->employee_id;
        if ($user->role === 'team_lead' && $user->employee) {
            return $q->whereIn('employee_id', array_unique([...$user->employee->ledEmployeeIds(), $own]));
        }

        return $q->where('employee_id', $own);
    }

    /** Claims the viewer can act on next: lead verifies submitted, management approves verified then pays, HR pays approved. */
    public static function awaiting(User $user): Builder
    {
        $q = ContractorClaim::query();
        $own = $user->employee_id;

        return match (true) {
            $user->role === 'management' => $q->whereIn('status', ['verified', 'approved'])->where('employee_id', '!=', $own),
            $user->role === 'hr' => $q->where('status', 'approved'),
            $user->role === 'team_lead' && $user->employee => $q->where('status', 'submitted')
                ->whereIn('employee_id', array_values(array_diff($user->employee->ledEmployeeIds(), [$own]))),
            default => $q->whereRaw('1 = 0'),
        };
    }
}
