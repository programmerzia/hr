<?php

namespace App\Policies;

use App\Models\LeaveRequest;
use App\Models\User;

class LeaveRequestPolicy
{
    public function cancel(User $user, LeaveRequest $request): bool
    {
        return $user->employee_id === $request->employee_id;
    }

    /** Team lead over the requester's team. Own requests are refused by the action with the mock's message. */
    public function approveLead(User $user, LeaveRequest $request): bool
    {
        return $user->role === 'team_lead' && (bool) $user->employee?->leads($request->employee()->first());
    }

    public function approveHr(User $user, LeaveRequest $request): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    /** Deciding at whichever stage the request is currently at. */
    public function decide(User $user, LeaveRequest $request): bool
    {
        if ($user->employee_id !== null && $user->employee_id === $request->employee_id) {
            return false;
        }

        return match ($request->status) {
            'pending_lead' => $this->approveLead($user, $request),
            'pending_hr' => $this->approveHr($user, $request),
            default => false,
        };
    }
}
