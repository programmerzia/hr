<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/** Permission catalogue + system-role seed for Spatie RBAC (docs/08-access-control.md). */
final class Access
{
    public const MODULES = [
        'attendance' => 'Attendance', 'leave' => 'Leave', 'people' => 'People', 'payroll' => 'Payroll',
        'billing' => 'Billing', 'claims' => 'Claims', 'projects' => 'Projects', 'reports' => 'Reports',
        'settings' => 'Settings', 'access' => 'Access',
    ];

    /** @var list<array{name:string,label:string,module:string}> */
    public const PERMISSIONS = [
        ['name' => 'view_team', 'label' => 'View team attendance, history, regularisations, overtime', 'module' => 'attendance'],
        ['name' => 'approve_leave_lead', 'label' => 'Approve leave for own team', 'module' => 'leave'],
        ['name' => 'approve_leave_hr', 'label' => 'Approve leave company-wide, manage leave types', 'module' => 'leave'],
        ['name' => 'manage_people', 'label' => 'Onboard, edit employees, approve password resets', 'module' => 'people'],
        ['name' => 'manage_payroll', 'label' => 'Draft, review, hold, adjust payroll runs', 'module' => 'payroll'],
        ['name' => 'approve_payroll', 'label' => 'Approve, pay, reopen payroll runs', 'module' => 'payroll'],
        ['name' => 'manage_billing', 'label' => 'Clients and invoices', 'module' => 'billing'],
        ['name' => 'verify_claims', 'label' => 'Verify contractor claims', 'module' => 'claims'],
        ['name' => 'approve_claims', 'label' => 'Approve claims', 'module' => 'claims'],
        ['name' => 'manage_projects', 'label' => 'Create projects, columns, members', 'module' => 'projects'],
        ['name' => 'view_reports', 'label' => 'Company reports and CSV exports', 'module' => 'reports'],
        ['name' => 'manage_policy', 'label' => 'Attendance/payroll policies, holidays', 'module' => 'settings'],
        ['name' => 'manage_settings', 'label' => 'Edit leave types from the Leave policy page', 'module' => 'settings'],
        ['name' => 'manage_access', 'label' => 'Roles & permissions', 'module' => 'access'],
    ];

    public const SYSTEM_ROLES = [
        'employee' => 'Employee', 'team_lead' => 'Team lead', 'hr' => 'HR', 'management' => 'Management', 'contractor' => 'Contractor',
    ];

    /** @return list<string> */
    public static function names(): array
    {
        return array_column(self::PERMISSIONS, 'name');
    }

    /** Seed matrix for a system role: Abilities::TABLE + manage_access → management. @return list<string> */
    public static function defaultsFor(string $role): array
    {
        $perms = array_keys(array_filter(Abilities::TABLE, fn ($roles) => in_array($role, $roles, true)));
        if ($role === 'management') {
            $perms[] = 'manage_access';
        }

        return $perms;
    }

    /** Idempotent: creates missing permissions/system roles (seeding new roles only), guarantees management keeps manage_access, and gives each user the Spatie role named by users.role. */
    public static function sync(): array
    {
        $stats = ['permissions' => 0, 'roles' => 0, 'users' => 0];
        self::flush();
        foreach (self::PERMISSIONS as $p) {
            $perm = Permission::firstOrCreate(['name' => $p['name'], 'guard_name' => 'web']);
            $stats['permissions'] += (int) $perm->wasRecentlyCreated;
        }
        self::flush();
        foreach (self::SYSTEM_ROLES as $name => $label) {
            $role = Role::firstOrCreate(['name' => $name, 'guard_name' => 'web'], ['label' => $label, 'is_system' => true]);
            if ($role->wasRecentlyCreated) {
                $role->syncPermissions(self::defaultsFor($name));
                $stats['roles']++;
            } elseif (! $role->is_system) {
                $role->forceFill(['is_system' => true])->save();
            }
        }
        Role::findByName('management', 'web')->givePermissionTo('manage_access');
        self::flush();

        $known = Role::pluck('name')->all();
        User::query()->with('roles')->each(function (User $user) use ($known, &$stats) {
            if (in_array($user->role, $known, true) && $user->roles->pluck('name')->all() !== [$user->role]) {
                $user->syncRoles([$user->role]);
                $stats['users']++;
            }
        });
        self::flush();

        return $stats;
    }

    public static function flush(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Users currently holding manage_access (via role or direct). */
    public static function managersCount(): int
    {
        return User::permission('manage_access')->count();
    }

    public static function tablesExist(): bool
    {
        return DB::getSchemaBuilder()->hasTable(config('permission.table_names.roles'));
    }
}
