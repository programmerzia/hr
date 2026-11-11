<?php

namespace App\Http\Controllers\Work;

use App\Domain\Work\Actions\CreateTask;
use App\Domain\Work\Actions\MoveTask;
use App\Domain\Work\Actions\TaskExtras;
use App\Domain\Work\Actions\UpdateTask;
use App\Http\Controllers\Controller;
use App\Http\Requests\Work\StoreTaskRequest;
use App\Http\Requests\Work\TaskActionRequest;
use App\Http\Requests\Work\UpdateTaskRequest;
use App\Models\Attachment;
use App\Models\BoardColumn;
use App\Models\Project;
use App\Models\Subtask;
use App\Models\Task;
use App\Models\TaskComment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TaskController extends Controller
{
    public function store(StoreTaskRequest $request, CreateTask $create): RedirectResponse
    {
        $project = Project::findOrFail($request->validated('project_id'));
        $task = $create($project, $request->validated(), $request->user()->employee_id);
        $path = parse_url(url()->previous(), PHP_URL_PATH) ?: route('work.board', $project, false);

        return redirect($path.'?task='.$task->key);
    }

    public function update(UpdateTaskRequest $request, Task $task, UpdateTask $update): RedirectResponse
    {
        $update($task, $request->validated(), $request->user()->employee_id);

        return back();
    }

    public function move(TaskActionRequest $request, Task $task, MoveTask $move): RedirectResponse
    {
        $move($task, BoardColumn::findOrFail($request->validated('column_id')), $request->validated('position'), $request->user()->employee_id);

        return back();
    }

    public function addSubtask(TaskActionRequest $request, Task $task, TaskExtras $extras): RedirectResponse
    {
        $extras->addSubtask($task, $request->validated('title'), $request->user()->employee_id);

        return back();
    }

    public function toggleSubtask(TaskActionRequest $request, Subtask $subtask, TaskExtras $extras): RedirectResponse
    {
        $extras->toggleSubtask($subtask, $request->user()->employee_id);

        return back();
    }

    public function comment(TaskActionRequest $request, Task $task, TaskExtras $extras): RedirectResponse
    {
        $extras->addComment($task, $request->validated('body'), $request->file('files', []), $request->user()->employee_id);

        return back();
    }

    public function attach(TaskActionRequest $request, Task $task, TaskExtras $extras): RedirectResponse
    {
        $extras->addAttachment($task, $request->file('file'), $request->user()->employee_id);

        return back();
    }

    public function download(Request $request, Attachment $attachment): BinaryFileResponse
    {
        $task = match ($attachment->attachable_type) {
            'task' => Task::find($attachment->attachable_id),
            'task_comment' => TaskComment::find($attachment->attachable_id)?->task,
            default => null,
        };
        abort_unless($task, 404);
        Gate::authorize('view', $task);

        return response()->file(Storage::disk('local')->path($attachment->path), [
            'Content-Type' => $attachment->mime,
            'Content-Disposition' => 'inline; filename="'.addslashes($attachment->name).'"',
        ]);
    }
}
