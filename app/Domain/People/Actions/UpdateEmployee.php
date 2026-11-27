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
            $fields = ['name', 'designation', 'email', 'phone', 'team_id', 'department_id'];
            $before = $employee->only($fields);
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

            $diff = Concerns::diff($before, $employee->only($fields));
            if ($diff) {
                foreach (['team_id' => Team::class, 'department_id' => \App\Models\Department::class] as $k => $model) {
                    if (isset($diff[$k])) {
                        $diff[str_replace('_id', '', $k)] = ['from' => $diff[$k]['from'] ? $model::find($diff[$k]['from'])?->name : null, 'to' => $diff[$k]['to'] ? $model::find($diff[$k]['to'])?->name : null];
                        unset($diff[$k]);
                    }
                }
                Concerns::audit($employee, 'Updated details. '.Concerns::describe($diff), ['changes' => $diff]);
            }

            return $employee;
        });
    }
}
