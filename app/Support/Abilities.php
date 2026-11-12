<?php

namespace App\Support;

use App\Models\User;

/** Mirrors resources/js/lib/permissions.ts. Role-level only; scope lives in policies. */
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
    ];

    public static function can(string $role, string $ability): bool
    {
        return in_array($role, self::TABLE[$ability] ?? [], true);
    }

    /** @return list<string> */
    public static function for(User $user): array
    {
        return array_values(array_keys(array_filter(self::TABLE, fn ($roles) => in_array($user->role, $roles, true))));
    }
}
