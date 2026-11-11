<?php

namespace App\Policies;

use App\Models\AttendanceDay;
use App\Models\User;

class AttendanceDayPolicy
{
    public function view(User $user, AttendanceDay $day): bool
    {
        if (in_array($user->role, ['hr', 'management'], true) || $user->employee_id === $day->employee_id) {
            return true;
        }

        return $user->role === 'team_lead' && in_array($day->employee_id, $user->employee?->ledEmployeeIds() ?? [], true);
    }

    /** Deciding regularizations: in scope, not own day, not a plain employee. */
    public function regularize(User $user, AttendanceDay $day): bool
    {
        return $user->role !== 'employee' && $user->employee_id !== $day->employee_id && $this->view($user, $day);
    }

    /** Requesting a regularization: only for your own day. */
    public function request(User $user, AttendanceDay $day): bool
    {
        return $user->employee_id !== null && $user->employee_id === $day->employee_id;
    }
}
