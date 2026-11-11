<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use App\Models\Team;
use Illuminate\Support\Facades\DB;

class UpdateEmployee
{
    public function __invoke(Employee $employee, array $patch): Employee
    {
        return DB::transaction(function () use ($employee, $patch) {
            $oldDesignation = $employee->designation;
            $oldTeam = $employee->team_id;
            $team = ! empty($patch['team_id']) ? Team::find($patch['team_id']) : null;
            $employee->fill([
                'name' => trim($patch['name']),
                'designation' => trim($patch['designation']),
                'email' => trim($patch['email']),
                'phone' => trim($patch['phone'] ?? ''),
                'team_id' => $team?->id,
                'department_id' => $team?->department_id ?? $employee->department_id,
            ])->save();

            Concerns::userOf($employee)?->forceFill(['name' => $employee->name, 'email' => $employee->email])->save();

            if ($employee->designation !== $oldDesignation) {
                Concerns::event($employee, 'designation', 'Designation changed from '.mb_strtolower($oldDesignation).' to '.mb_strtolower($employee->designation));
            }
            if ($employee->team_id !== $oldTeam) {
                Concerns::setTeam($employee, $employee->team_id);
                Concerns::event($employee, 'team', $team ? "Moved to {$team->name}" : 'Removed from team');
            }

            return $employee;
        });
    }
}
