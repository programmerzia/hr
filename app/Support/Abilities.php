<?php

namespace App\Support;

use App\Models\User;

/** TABLE is the seed matrix for system roles; live checks go through Spatie permissions. Scope lives in policies. */
final class Abilities
{
    public const TABLE = [
        'view_team' => ['team_lead', 'hr', 'management'],
        'approve_leave_lead' => ['team_lead', 'management'],
        'approve_leave_hr' => ['hr', 'management'],
        'manage_people' => ['hr', 'management'],
        'manage_payroll' => ['hr', 'management'],
        'approve_payroll' => ['management'],
        'manage_billing' => ['management'],
        'verify_claims' => ['team_lead', 'management'],
        'approve_claims' => ['management'],
        'manage_projects' => ['team_lead', 'management'],
        'manage_settings' => ['hr', 'management'],
        'manage_policy' => ['hr', 'management'],
        'view_reports' => ['hr', 'management'],
    ];

    /** Seed-matrix check (role defaults only). Runtime checks use has(). */
    public static function can(string $role, string $ability): bool
    {
        return in_array($role, self::TABLE[$ability] ?? [], true);
    }

    public static function has(User $user, string $ability): bool
    {
        return $user->checkPermissionTo($ability);
    }

    /** @return list<string> */
    public static function for(User $user): array
    {
        $has = $user->getAllPermissions()->pluck('name')->all();

        return array_values(array_intersect(Access::names(), $has));
    }
}
