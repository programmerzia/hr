<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * The one visibility rule for people lists (docs/08). It never reads users.role:
 *  - view_company: every employee still employed.
 *  - view_team: the teams the person leads, employees with no team (unless they hold view_company
 *    themselves, so a lead does not see HR or management staff), and themselves.
 *  - otherwise: themselves only.
 */
final class Scope
{
    public static function company(User $user): bool
    {
        return $user->checkPermissionTo('view_company');
    }

    /** Employee ids of people who hold view_company (kept out of the "unassigned" group). @return list<string> */
    private static function companyHolderIds(): array
    {
        return User::permission('view_company')->whereNotNull('employee_id')->pluck('employee_id')->all();
    }

    /** @return Builder<Employee> */
    public static function employees(User $user): Builder
    {
        $q = Employee::query()->whereNull('exited_on');
        if (self::company($user)) {
            return $q;
        }
        $own = $user->employee_id;
        if (! $user->checkPermissionTo('view_team')) {
            return $q->whereIn('id', $own ? [$own] : []);
        }
        $led = $user->employee ? $user->employee->ledEmployeeIds() : [];
        $hidden = self::companyHolderIds();

        return $q->where(function (Builder $w) use ($led, $own, $hidden) {
            $w->whereIn('id', array_values(array_unique([...$led, ...($own ? [$own] : [])])))
                ->orWhere(fn (Builder $x) => $x->whereNull('team_id')->whereNotIn('id', $hidden));
        });
    }

    /** Whether the viewer may see this employee (exited people included, unlike employees()). */
    public static function canSee(User $user, Employee $employee): bool
    {
        if (self::company($user) || ($user->employee_id !== null && $user->employee_id === $employee->id)) {
            return true;
        }
        if (! $user->checkPermissionTo('view_team')) {
            return false;
        }
        if ($user->employee?->leads($employee)) {
            return true;
        }

        return $employee->team_id === null && ! in_array($employee->id, self::companyHolderIds(), true);
    }

    /** Employees whose regularizations the user may decide: in scope, minus themselves, and only with view_team. */
    public static function decideIds(User $user): array
    {
        if (! $user->checkPermissionTo('view_team')) {
            return [];
        }

        return self::employees($user)->where('id', '!=', $user->employee_id)->pluck('id')->all();
    }

    /**
     * Users who may decide this employee's regularization / who should hear about it: view_team holders that
     * can see the employee, never the employee. Falls back to manage_access holders when nobody qualifies.
     *
     * @return Collection<int, User>
     */
    public static function deciders(Employee $employee): Collection
    {
        $lead = LeaveNotifier::leadOf($employee);
        $users = $lead
            ? User::where('employee_id', $lead->id)->get()
            : User::permission('view_company')->get()->filter(fn (User $u) => $u->checkPermissionTo('view_team'));
        $users = $users->reject(fn (User $u) => $u->employee_id === $employee->id)->values();
        if ($users->isEmpty()) {
            $users = User::permission('manage_access')->get()->reject(fn (User $u) => $u->employee_id === $employee->id)->values();
        }

        return $users;
    }
}
