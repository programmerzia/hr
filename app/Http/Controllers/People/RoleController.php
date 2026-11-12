<?php

namespace App\Http\Controllers\People;

use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Access\ChangeRoleRequest;
use App\Models\Employee;
use App\Models\User;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function update(ChangeRoleRequest $request, Employee $employee): RedirectResponse
    {
        $user = $employee->user;
        if (! $user) {
            return back()->with('error', "{$employee->name} has no login.");
        }
        if ($user->is($request->user())) {
            return back()->with('error', 'You cannot change your own role.');
        }
        $new = $request->validated('role');
        $keeps = Role::findByName($new, 'web')->hasPermissionTo('manage_access') || $user->permissions->contains('name', 'manage_access');
        if (! $keeps && $user->checkPermissionTo('manage_access') && User::permission('manage_access')->whereKeyNot($user->id)->doesntExist()) {
            return back()->with('error', 'At least one person must keep Roles & permissions.');
        }
        $old = $user->role;
        $user->update(['role' => $new]); // User::saved syncs the Spatie role
        $user->syncRoles([$new]);
        Access::flush();
        SettingsLog::record($request->user(), 'access', "changed {$employee->name}'s role from {$old} to {$new}", ['user' => $user->id, 'from' => $old, 'to' => $new], $employee->id);

        return back()->with('success', 'Role updated');
    }
}
