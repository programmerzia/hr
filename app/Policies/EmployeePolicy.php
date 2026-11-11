<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

class EmployeePolicy
{
    /** Self, team lead over own teams, HR and management over everyone. */
    public function view(User $user, Employee $employee): bool
    {
        if (in_array($user->role, ['hr', 'management'], true) || $user->employee_id === $employee->id) {
            return true;
        }

        return $user->role === 'team_lead' && $user->employee?->leads($employee);
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    public function update(User $user, Employee $employee): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    public function viewCompensation(User $user, Employee $employee): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }
}
