<?php

namespace App\Domain\Leave\Services;

use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Requests waiting for the viewer: leads see pending_lead of their teams, HR and management see pending_hr. */
final class ApprovalScope
{
    /** @return Builder<LeaveRequest> */
    public static function pending(User $user): Builder
    {
        $q = LeaveRequest::query();
        $own = $user->employee_id;
        if ($user->role === 'team_lead' && $user->employee) {
            $ids = array_values(array_diff($user->employee->ledEmployeeIds(), [$own]));

            return $q->where('status', 'pending_lead')->whereIn('employee_id', $ids);
        }
        if (in_array($user->role, ['hr', 'management'], true)) {
            return $q->where('status', 'pending_hr')->where('employee_id', '!=', $own);
        }

        return $q->whereRaw('1 = 0');
    }
}
