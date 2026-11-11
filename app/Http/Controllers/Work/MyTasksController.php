<?php

namespace App\Http\Controllers\Work;

use App\Domain\Work\WorkData;
use App\Http\Controllers\Controller;
use App\Models\BoardColumn;
use App\Models\Task;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyTasksController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $key = $request->query('task');
        $mine = fn () => Task::with('project')->where('assignee_id', $user->employee_id)
            ->whereNotIn('column_id', BoardColumn::where('is_done', true)->select('id'))
            ->orderBy('due_on')->get();

        return Inertia::render('Work/MyTasksPage', [
            'tasks' => fn () => WorkData::taskRows($mine()),
            'projects' => fn () => $mine()->pluck('project')->unique('id')->sortBy('name')->map(fn ($p) => WorkData::projectRow($p))->values()->all(),
            'columns' => fn () => BoardColumn::whereIn('project_id', $mine()->pluck('project_id')->unique())->orderBy('position')->get()
                ->map(fn ($c) => ['id' => $c->id, 'project_id' => $c->project_id, 'name' => $c->name, 'position' => $c->position, 'is_done' => $c->is_done])->all(),
            'task_key' => $key,
            'task' => fn () => ($t = WorkData::taskByKey($key, $user)) ? WorkData::drawer($t, $user) : null,
        ]);
    }
}
