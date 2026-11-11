<?php

namespace App\Domain\Work\Actions;

use App\Models\BoardColumn;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

/** Project settings: fields, members, columns. */
class ManageProject
{
    public function update(Project $project, array $data): void
    {
        $project->update($data);
        if (isset($data['lead_employee_id'])) {
            ProjectMember::firstOrCreate(['project_id' => $project->id, 'employee_id' => $data['lead_employee_id']]);
        }
    }

    public function addMember(Project $project, string $employeeId): void
    {
        ProjectMember::firstOrCreate(['project_id' => $project->id, 'employee_id' => $employeeId]);
    }

    /** The lead cannot be removed; their tasks in this project become unassigned. */
    public function removeMember(Project $project, string $employeeId): bool
    {
        if ($project->lead_employee_id === $employeeId) {
            return false;
        }
        DB::transaction(function () use ($project, $employeeId) {
            ProjectMember::where('project_id', $project->id)->where('employee_id', $employeeId)->delete();
            Task::where('project_id', $project->id)->where('assignee_id', $employeeId)->update(['assignee_id' => null]);
        });

        return true;
    }

    public function addColumn(Project $project, string $name): BoardColumn
    {
        return BoardColumn::create([
            'project_id' => $project->id,
            'name' => trim($name),
            'position' => BoardColumn::where('project_id', $project->id)->count(),
            'is_done' => false,
        ]);
    }

    public function renameColumn(BoardColumn $column, string $name): void
    {
        $column->update(['name' => trim($name)]);
    }

    /** @param list<string> $orderedIds */
    public function reorderColumns(Project $project, array $orderedIds): void
    {
        DB::transaction(function () use ($project, $orderedIds) {
            foreach ($orderedIds as $i => $id) {
                BoardColumn::where('project_id', $project->id)->where('id', $id)->update(['position' => $i]);
            }
        });
    }
}
