<?php

namespace App\Domain\Work\Actions;

use App\Models\BoardColumn;
use App\Models\Project;
use App\Models\ProjectMember;
use Illuminate\Support\Facades\DB;

class CreateProject
{
    public const COLUMNS = [
        ['Backlog', false], ['To do', false], ['In progress', false], ['Review', false], ['Done', true],
    ];

    /** @param array{key:string,name:string,client_id:?string,lead_employee_id:string,billing_type:string} $data */
    public function __invoke(array $data): Project
    {
        return DB::transaction(function () use ($data) {
            $project = Project::create([
                'key' => $data['key'],
                'name' => trim($data['name']),
                'client_id' => $data['billing_type'] === 'internal' ? null : ($data['client_id'] ?? null),
                'lead_employee_id' => $data['lead_employee_id'],
                'billing_type' => $data['billing_type'],
                'status' => 'active',
            ]);
            foreach (self::COLUMNS as $i => [$name, $done]) {
                BoardColumn::create(['project_id' => $project->id, 'name' => $name, 'position' => $i, 'is_done' => $done]);
            }
            ProjectMember::create(['project_id' => $project->id, 'employee_id' => $project->lead_employee_id]);

            return $project;
        });
    }
}
