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
        return in_array($user->role, ['hr', 'management'], true) && $this->canTouchAccount($user, $employee);
    }

    /** HR may reset anyone's password except management accounts and their own (they use /account). */
    public function resetPassword(User $user, Employee $employee): bool
    {
        if (! in_array($user->role, ['hr', 'management'], true) || $user->employee_id === $employee->id) {
            return false;
        }

        return $this->canTouchAccount($user, $employee);
    }

    /** Only management may hand out the management role. */
    public function assignRole(User $user, string $role): bool
    {
        if ($role === 'management') {
            return $user->role === 'management';
        }

        return in_array($user->role, ['hr', 'management'], true);
    }

    /** Management accounts can only be changed by management. */
    private function canTouchAccount(User $user, Employee $employee): bool
    {
        if ($user->role === 'management') {
            return true;
        }

        return User::where('employee_id', $employee->id)->value('role') !== 'management';
    }

    public function viewCompensation(User $user, Employee $employee): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    /** Salary, bank and documents: HR and management, or the person themselves. */
    public function viewPay(User $user, Employee $employee): bool
    {
        return in_array($user->role, ['hr', 'management'], true) || $user->employee_id === $employee->id;
    }
}
