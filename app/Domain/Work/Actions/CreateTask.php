<?php

namespace App\Domain\Work\Actions;

use App\Models\BoardColumn;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskLabel;
use Illuminate\Support\Facades\DB;

class CreateTask
{
    public function __construct(private LogTaskActivity $log) {}

    public function __invoke(Project $project, array $data, string $actorId): Task
    {
        return DB::transaction(function () use ($project, $data, $actorId) {
            $cols = BoardColumn::where('project_id', $project->id)->orderBy('position')->get();
            $column = $cols->firstWhere('id', $data['column_id'] ?? null) ?? $cols->get(1) ?? $cols->first();
            $number = (int) Task::where('project_id', $project->id)->max('number') + 1;
            $task = Task::create([
                'project_id' => $project->id,
                'number' => $number,
                'title' => trim($data['title']),
                'body_md' => $data['body_md'] ?? '',
                'column_id' => $column->id,
                'priority' => $data['priority'] ?? 'medium',
                'assignee_id' => $data['assignee_id'] ?? null,
                'reporter_id' => $actorId,
                'estimate_minutes' => $data['estimate_minutes'] ?? null,
                'due_on' => $data['due_on'] ?? null,
                'position' => Task::where('column_id', $column->id)->count(),
            ]);
            foreach (array_unique($data['label_ids'] ?? []) as $labelId) {
                TaskLabel::create(['task_id' => $task->id, 'label_id' => $labelId]);
            }
            ($this->log)($task->id, $actorId, 'created the task');

            return $task->setRelation('project', $project);
        });
    }
}
