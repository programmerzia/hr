<?php

namespace App\Policies;

use App\Domain\Attendance\Services\Scope;
use App\Models\Employee;
use App\Models\User;
use Spatie\Permission\Models\Role;

class EmployeePolicy
{
    /** Self, anyone the viewer's visibility scope covers (view_company, led teams, unassigned people). */
    public function view(User $user, Employee $employee): bool
    {
        return Scope::canSee($user, $employee);
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->checkPermissionTo('manage_people');
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->checkPermissionTo('manage_people') && $this->canTouchAccount($user, $employee);
    }

    /** Anyone with manage_people may reset a password except admin accounts (manage_access) and their own (they use /account). */
    public function resetPassword(User $user, Employee $employee): bool
    {
        if (! $user->checkPermissionTo('manage_people') || $user->employee_id === $employee->id) {
            return false;
        }

        return $this->canTouchAccount($user, $employee);
    }

    /** Only admins (manage_access) may hand out a role that carries manage_access. */
    public function assignRole(User $user, string $role): bool
    {
        $r = Role::where('name', $role)->where('guard_name', 'web')->first();
        if ($r?->hasPermissionTo('manage_access')) {
            return $user->checkPermissionTo('manage_access');
        }

        return $user->checkPermissionTo('manage_people');
    }

    /** Admin accounts (manage_access) can only be changed by admins. */
    private function canTouchAccount(User $user, Employee $employee): bool
    {
        if ($user->checkPermissionTo('manage_access')) {
            return true;
        }

        return ! User::where('employee_id', $employee->id)->first()?->checkPermissionTo('manage_access');
    }

    public function viewCompensation(User $user, Employee $employee): bool
    {
        return $user->checkPermissionTo('manage_people');
    }

    /** Salary, bank and documents: manage_people holders, or the person themselves. */
    public function viewPay(User $user, Employee $employee): bool
    {
        return $user->checkPermissionTo('manage_people') || $user->employee_id === $employee->id;
    }
}
