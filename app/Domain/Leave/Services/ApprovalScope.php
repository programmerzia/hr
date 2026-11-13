<?php

namespace App\Domain\Leave\Services;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Requests waiting for the viewer: leads see pending_lead of their teams, HR and management see pending_hr. */
final class ApprovalScope
{
    /**
     * Whoever leads the requester's team sees pending_lead (any role). HR and management see
     * pending_hr plus pending_lead, so a request never gets stuck when the lead has no
     * team_lead account. Approvers without an employee profile still see everything.
     *
     * @return Builder<LeaveRequest>
     */
    public static function pending(User $user): Builder
    {
        $q = LeaveRequest::query();
        $own = $user->employee_id;
        $led = $user->employee ? array_values(array_diff($user->employee->ledEmployeeIds(), [$own])) : [];
        $isHr = in_array($user->role, ['hr', 'management'], true);

        if (! $isHr && $led === []) {
            return $q->whereRaw('1 = 0');
        }
        if ($own !== null) {
            $q->where('employee_id', '!=', $own);
        }

        return $q->where(function (Builder $w) use ($isHr, $led) {
            if ($isHr) {
                $w->whereIn('status', ['pending_hr', 'pending_lead']);
            }
            if ($led !== []) {
                $w->orWhere(fn (Builder $x) => $x->where('status', 'pending_lead')->whereIn('employee_id', $led));
            }
        });
    }
}
