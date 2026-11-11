<?php

namespace App\Domain\Attendance\Services;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/** Port of scopeEmployees(): lead sees their teams (and themselves), HR/management see everyone still employed. */
final class Scope
{
    /** @return Builder<Employee> */
    public static function employees(User $user): Builder
    {
        $q = Employee::query()->whereNull('exited_on');
        if (in_array($user->role, ['hr', 'management'], true)) {
            return $q;
        }
        $ids = $user->role === 'team_lead' && $user->employee ? $user->employee->ledEmployeeIds() : [];
        if ($user->employee_id) {
            $ids[] = $user->employee_id;
        }

        return $q->whereIn('id', array_unique($ids));
    }

    /** Employees whose regularizations the user may decide: scope minus themselves, none for plain employees. */
    public static function decideIds(User $user): array
    {
        if ($user->role === 'employee') {
            return [];
        }

        return self::employees($user)->where('id', '!=', $user->employee_id)->pluck('id')->all();
    }
}
