<?php

namespace App\Domain\Work;

use App\Http\Resources\AttachmentResource;
use App\Http\Resources\BoardColumnResource;
use App\Http\Resources\LabelResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\SubtaskResource;
use App\Http\Resources\TaskActivityResource;
use App\Http\Resources\TaskCommentResource;
use App\Http\Resources\TaskResource;
use App\Models\Attachment;
use App\Models\BoardColumn;
use App\Models\Client;
use App\Models\Employee;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Subtask;
use App\Models\Task;
use App\Models\TaskActivity;
use App\Models\TaskComment;
use App\Models\TaskLabel;
use App\Models\TaskTimeEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/** Builds the Inertia props of the Work pages. Shapes follow resources/js/types/index.ts. */
final class WorkData
{
    /** Projects the viewer may open: HR and management all, others members and leads. */
    public static function visibleProjects(User $user): Builder
    {
        $q = Project::query()->orderBy('name');
        if (in_array($user->role, ['hr', 'management'], true)) {
            return $q;
        }

        return $q->where(function ($w) use ($user) {
            $w->where('lead_employee_id', $user->employee_id)
                ->orWhereIn('id', ProjectMember::where('employee_id', $user->employee_id)->select('project_id'));
        });
    }

    /** @param Collection<int, string|null> $ids  @return list<array{id:string,name:string}> */
    public static function people(Collection $ids): array
    {
        return Employee::whereIn('id', $ids->filter()->unique()->values())->orderBy('name')->get(['id', 'name'])
            ->map(fn ($e) => ['id' => $e->id, 'name' => $e->name])->all();
    }

    /** Task rows for boards and lists: TS Task plus label ids and subtask counts. @return list<array<string,mixed>> */
    public static function taskRows(Collection $tasks): array
    {
        $ids = $tasks->pluck('id');
        $labels = TaskLabel::whereIn('task_id', $ids)->get()->groupBy('task_id');
        $subs = Subtask::whereIn('task_id', $ids)->get()->groupBy('task_id');

        return $tasks->map(fn (Task $t) => [
            ...TaskResource::make($t)->resolve(),
            'label_ids' => ($labels[$t->id] ?? collect())->pluck('label_id')->values()->all(),
            'subtask_total' => ($subs[$t->id] ?? collect())->count(),
            'subtask_done' => ($subs[$t->id] ?? collect())->where('done', true)->count(),
        ])->values()->all();
    }

    public static function projectRow(Project $p): array
    {
        return [...ProjectResource::make($p)->resolve(), 'client_name' => $p->client?->name];
    }

    /** Full task for the drawer. */
    public static function drawer(Task $task, User $user): array
    {
        $task->loadMissing('project');
        $commentIds = TaskComment::where('task_id', $task->id)->pluck('id');
        $attachments = Attachment::where(fn ($q) => $q->where('attachable_type', 'task')->where('attachable_id', $task->id))
            ->orWhere(fn ($q) => $q->where('attachable_type', 'task_comment')->whereIn('attachable_id', $commentIds))
            ->orderBy('created_at')->get();

        $comments = TaskComment::where('task_id', $task->id)->orderBy('created_at')->get();
        $activity = TaskActivity::where('task_id', $task->id)->orderByDesc('at')->get();
        $memberIds = ProjectMember::where('project_id', $task->project_id)->pluck('employee_id');
        $project = $task->project;

        return [
            ...self::taskRows(collect([$task]))[0],
            'project' => ['id' => $project->id, 'key' => $project->key, 'name' => $project->name],
            'columns' => BoardColumnResource::collection(BoardColumn::where('project_id', $task->project_id)->orderBy('position')->get())->resolve(),
            'labels' => LabelResource::collection(Label::where(fn ($q) => $q->whereNull('project_id')->orWhere('project_id', $task->project_id))->orderBy('name')->get())->resolve(),
            'member_ids' => $memberIds->values()->all(),
            'people' => self::people($memberIds->merge([$task->assignee_id, $task->reporter_id])
                ->merge($comments->pluck('author_id'))->merge($activity->pluck('actor_id'))),
            'can_edit' => $user->can('update', $task),
            'subtasks' => SubtaskResource::collection(Subtask::where('task_id', $task->id)->orderBy('position')->get())->resolve(),
            'comments' => TaskCommentResource::collection($comments)->resolve(),
            'attachments' => $attachments->map(fn ($a) => [...AttachmentResource::make($a)->resolve(), 'path' => route('work.attachments.download', $a)])->values()->all(),
            'activity' => TaskActivityResource::collection($activity)->resolve(),
            'tracked_seconds' => (int) TaskTimeEntry::where('task_id', $task->id)->sum('seconds'),
        ];
    }

    /** `PULSE-12` -> task of a project the viewer can open. */
    public static function taskByKey(?string $key, User $user, ?Project $within = null): ?Task
    {
        if (! $key || ! preg_match('/^([A-Z]{2,6})-(\d+)$/', $key, $m)) {
            return null;
        }
        $project = $within ?? self::visibleProjects($user)->where('key', $m[1])->first();
        if (! $project || $project->key !== $m[1]) {
            return null;
        }

        return Task::where('project_id', $project->id)->where('number', (int) $m[2])->first();
    }

    /** Shared by the board and list pages (closures, so partial reloads stay cheap). @return array<string,mixed> */
    public static function projectScreen(Project $project, User $user, ?string $taskKey): array
    {
        $manage = $user->can('manage', $project);
        $tasks = fn () => Task::with('project')->where('project_id', $project->id)->orderBy('position')->orderBy('number')->get();
        $memberIds = fn () => ProjectMember::where('project_id', $project->id)->pluck('employee_id');

        return [
            'project' => fn () => self::projectRow($project->loadMissing('client')),
            'columns' => fn () => BoardColumnResource::collection(BoardColumn::where('project_id', $project->id)->orderBy('position')->get())->resolve(),
            'tasks' => fn () => self::taskRows($tasks()),
            'members' => fn () => $memberIds()->map(fn ($id) => ['project_id' => $project->id, 'employee_id' => $id])->values()->all(),
            'labels' => fn () => LabelResource::collection(Label::where(fn ($q) => $q->whereNull('project_id')->orWhere('project_id', $project->id))->orderBy('name')->get())->resolve(),
            'people' => fn () => self::people($memberIds()->merge($tasks()->flatMap(fn ($t) => [$t->assignee_id, $t->reporter_id]))
                ->merge(TaskComment::whereIn('task_id', Task::where('project_id', $project->id)->select('id'))->pluck('author_id'))
                ->merge(TaskActivity::whereIn('task_id', Task::where('project_id', $project->id)->select('id'))->pluck('actor_id'))
                ->push($project->lead_employee_id)),
            'candidates' => fn () => $manage ? self::people(Employee::whereIn('status', ['active', 'probation', 'on_leave'])
                ->whereNotIn('id', $memberIds())->pluck('id')) : [],
            'can_write' => fn () => $user->can('write', $project),
            'can_manage' => fn () => $manage,
            'task_key' => $taskKey,
            'task' => fn () => ($t = self::taskByKey($taskKey, $user, $project)) ? self::drawer($t, $user) : null,
        ];
    }

    /** @return list<array{id:string,name:string}> */
    public static function clients(): array
    {
        return Client::orderBy('name')->get(['id', 'name'])->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])->all();
    }
}
