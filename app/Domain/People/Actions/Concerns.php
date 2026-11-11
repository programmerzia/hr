<?php

namespace App\Domain\People\Actions;

use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;

/** Shared helpers for the People actions. */
final class Concerns
{
    public const TEMP_PASSWORD = 'welcome123';

    public const DEFAULT_CHECKLIST = [
        'Laptop issued',
        'Email and chat accounts created',
        'Policy acknowledgement signed',
        'Bank details verified',
        'Employment contract signed',
    ];

    /** Employment history line (designation, team, status, joined), shown on the Employment tab. */
    public static function event(Employee $employee, string $kind, string $text, ?string $effectiveOn = null): void
    {
        ActivityLogEntry::create([
            'subject_type' => 'employee',
            'subject_id' => $employee->id,
            'actor_id' => auth()->user()?->employee_id,
            'description' => $text,
            'properties' => ['kind' => $kind, 'effective_on' => $effectiveOn ?? now()->toDateString()],
        ]);
    }

    public static function setTeam(Employee $employee, ?string $teamId): void
    {
        TeamMember::where('employee_id', $employee->id)->delete();
        if ($teamId) {
            TeamMember::create(['team_id' => $teamId, 'employee_id' => $employee->id]);
        }
    }

    public static function userOf(Employee $employee): ?User
    {
        return User::where('employee_id', $employee->id)->first();
    }

    public static function teamName(?string $teamId): ?string
    {
        return $teamId ? Team::find($teamId)?->name : null;
    }

    public static function gross(array $s): int
    {
        return (int) $s['basic'] + (int) $s['house_rent'] + (int) $s['medical'] + (int) $s['conveyance'];
    }
}
