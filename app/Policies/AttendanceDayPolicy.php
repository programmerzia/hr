<?php

namespace App\Policies;

use App\Domain\Attendance\Services\Scope;
use App\Models\AttendanceDay;
use App\Models\User;

class AttendanceDayPolicy
{
    public function view(User $user, AttendanceDay $day): bool
    {
        if ($user->employee_id === $day->employee_id) {
            return true;
        }

        return Scope::canSee($user, $day->employee()->firstOrFail());
    }

    /** Deciding regularizations: in scope, not own day, view_team. */
    public function regularize(User $user, AttendanceDay $day): bool
    {
        return $user->checkPermissionTo('view_team') && $user->employee_id !== $day->employee_id && $this->view($user, $day);
    }

    /** Requesting a regularization: only for your own day. */
    public function request(User $user, AttendanceDay $day): bool
    {
        return $user->employee_id !== null && $user->employee_id === $day->employee_id;
    }
}
