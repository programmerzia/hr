<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Access\PermissionsRequest;
use App\Http\Requests\Access\StoreRoleRequest;
use App\Models\User;
use App\Support\Access;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class AccessController extends Controller
{
    public function index(): Response
    {
        $counts = User::query()->selectRaw('role, count(*) as c')->groupBy('role')->pluck('c', 'role');

        return Inertia::render('Settings/AccessPage', [
            'roles' => Role::with('permissions:id,name')->orderByDesc('is_system')->orderBy('id')->get()->map(fn (Role $r) => [
                'id' => $r->id, 'name' => $r->name, 'label' => $r->label ?? $r->name, 'is_system' => (bool) $r->is_system,
                'users_count' => (int) ($counts[$r->name] ?? 0),
                'permissions' => $r->permissions->pluck('name')->values()->all(),
            ])->all(),
            'permissions' => Access::PERMISSIONS,
            'modules' => collect(Access::MODULES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'users' => User::with('permissions:id,name')->orderBy('name')->get()->map(fn (User $u) => [
                'id' => $u->id, 'employee_id' => $u->employee_id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role,
                'direct_permissions' => $u->permissions->pluck('name')->values()->all(),
            ])->all(),
            'history' => SettingsLog::recent('access'),
        ]);
    }

    public function storeRole(StoreRoleRequest $request): RedirectResponse
    {
        $role = Role::create(['name' => $request->validated('name'), 'label' => $request->validated('label'), 'guard_name' => 'web', 'is_system' => false]);
        Access::flush();
        SettingsLog::record($request->user(), 'access', "created role {$role->label}", ['role' => $role->name]);

        return back()->with('success', 'Role created');
    }

    public function updateRole(PermissionsRequest $request, Role $role): RedirectResponse
    {
        $perms = $request->validated('permissions');
        if ($role->name === 'management' && ! in_array('manage_access', $perms, true)) {
            return back()->with('error', 'Management always keeps Roles & permissions.');
        }
        if (! in_array('manage_access', $perms, true) && $role->hasPermissionTo('manage_access')
            && User::permission('manage_access')->where('role', '!=', $role->name)->doesntExist()) {
            return back()->with('error', 'At least one person must keep Roles & permissions.');
        }
        $before = $role->permissions->pluck('name')->all();
        $role->syncPermissions($perms);
        if ($request->has('label') && ! $role->is_system) {
            $role->update(['label' => $request->validated('label')]);
        }
        Access::flush();
        $added = array_values(array_diff($perms, $before));
        $removed = array_values(array_diff($before, $perms));
        SettingsLog::record($request->user(), 'access', "updated role {$role->label}: +".(implode(', ', $added) ?: 'none').' / -'.(implode(', ', $removed) ?: 'none'),
            ['role' => $role->name, 'added' => $added, 'removed' => $removed]);

        return back()->with('success', 'Role saved');
    }

    public function destroyRole(Request $request, Role $role): RedirectResponse
    {
        abort_unless($request->user()->can('manage_access'), 403);
        if ($role->is_system) {
            return back()->with('error', 'Built-in roles cannot be deleted.');
        }
        if (User::where('role', $role->name)->exists() || $role->users()->exists()) {
            return back()->with('error', 'Move everyone off this role before deleting it.');
        }
        $label = $role->label;
        $role->delete();
        Access::flush();
        SettingsLog::record($request->user(), 'access', "deleted role {$label}", ['role' => $role->name]);

        return back()->with('success', 'Role deleted');
    }

    public function updateUserPermissions(PermissionsRequest $request, User $user): RedirectResponse
    {
        $perms = $request->validated('permissions');
        if (! in_array('manage_access', $perms, true) && $user->checkPermissionTo('manage_access')
            && ! $user->roles->contains(fn ($r) => $r->hasPermissionTo('manage_access'))
            && User::permission('manage_access')->whereKeyNot($user->id)->doesntExist()) {
            return back()->with('error', 'At least one person must keep Roles & permissions.');
        }
        $user->syncPermissions($perms);
        Access::flush();
        SettingsLog::record($request->user(), 'access', "set direct permissions for {$user->name}: ".(implode(', ', $perms) ?: 'none'), ['user' => $user->id], $user->employee_id);

        return back()->with('success', 'Overrides saved');
    }
}
