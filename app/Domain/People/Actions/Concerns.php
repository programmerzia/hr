<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use App\Support\Audit;

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
        Audit::record($employee, $text, auth()->user()?->employee_id, ['kind' => $kind, 'effective_on' => $effectiveOn ?? now()->toDateString()]);
    }

    /** Audit line for the employee's Activity tab (kept out of the Employment tab). Never put secrets in $props. */
    public static function audit(Employee $employee, string $text, array $props = []): void
    {
        Audit::log($employee, $text, null, ['audit' => true, ...$props]);
    }

    /** "name: 'a' to 'b'" lines for the fields that changed. @param array<string,mixed> $before @param array<string,mixed> $after */
    public static function diff(array $before, array $after): array
    {
        $out = [];
        foreach ($after as $k => $v) {
            if ((string) ($before[$k] ?? '') !== (string) ($v ?? '')) {
                $out[$k] = ['from' => $before[$k] ?? null, 'to' => $v];
            }
        }

        return $out;
    }

    public static function describe(array $diff): string
    {
        return implode('; ', array_map(fn ($k, $d) => str_replace('_', ' ', $k).': '.($d['from'] === null || $d['from'] === '' ? 'empty' : $d['from']).' to '.($d['to'] === null || $d['to'] === '' ? 'empty' : $d['to']), array_keys($diff), $diff));
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
