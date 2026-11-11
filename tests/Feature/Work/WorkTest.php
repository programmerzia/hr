<?php

use App\Models\BoardColumn;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskActivity;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function workFixture(): array
{
    $lead = makeUser('team_lead');
    $member = makeUser('employee');
    $outsider = makeUser('employee');
    $project = Project::factory()->create(['key' => 'PULSE', 'lead_employee_id' => $lead->employee_id]);
    ProjectMember::create(['project_id' => $project->id, 'employee_id' => $lead->employee_id]);
    ProjectMember::create(['project_id' => $project->id, 'employee_id' => $member->employee_id]);
    $todo = BoardColumn::factory()->create(['project_id' => $project->id, 'name' => 'To do', 'position' => 0]);
    $done = BoardColumn::factory()->create(['project_id' => $project->id, 'name' => 'Done', 'position' => 1, 'is_done' => true]);
    $task = Task::factory()->create([
        'project_id' => $project->id, 'number' => 1, 'column_id' => $todo->id, 'reporter_id' => $lead->employee_id,
        'assignee_id' => $member->employee_id,
    ]);

    return compact('lead', 'member', 'outsider', 'project', 'todo', 'done', 'task');
}

test('board renders with the task drawer props for ?task=KEY', function () {
    ['member' => $member, 'project' => $project, 'task' => $task] = workFixture();

    $this->actingAs($member)->get(route('work.board', $project).'?task=PULSE-1')
        ->assertInertia(fn ($page) => $page
            ->component('Work/BoardPage')
            ->where('project.key', 'PULSE')
            ->has('columns', 2)
            ->has('tasks', 1)
            ->where('task.id', $task->id)
            ->where('task.can_edit', true)
            ->has('task.subtasks', 0)->has('task.comments', 0)->has('task.activity', 0)
            ->where('task.tracked_seconds', 0));
});

test('non-members cannot open or write to a project', function () {
    ['outsider' => $outsider, 'project' => $project, 'todo' => $todo] = workFixture();

    $this->actingAs($outsider)->get(route('work.board', $project))->assertForbidden();
    $this->actingAs($outsider)->post(route('work.tasks.store'), ['project_id' => $project->id, 'title' => 'Nope', 'column_id' => $todo->id])->assertForbidden();
    expect(Task::count())->toBe(1);
});

test('a member creates a task and gets the next number', function () {
    ['member' => $member, 'project' => $project, 'todo' => $todo] = workFixture();

    $this->actingAs($member)->post(route('work.tasks.store'), ['project_id' => $project->id, 'title' => 'Ship it', 'column_id' => $todo->id])
        ->assertRedirect();
    expect(Task::where('title', 'Ship it')->first()->number)->toBe(2);
});

test('moving a task updates column, position and activity', function () {
    ['member' => $member, 'task' => $task, 'done' => $done] = workFixture();
    Task::factory()->create(['project_id' => $task->project_id, 'number' => 2, 'column_id' => $done->id, 'position' => 0, 'reporter_id' => $task->reporter_id]);

    $this->actingAs($member)->post(route('work.tasks.move', $task), ['column_id' => $done->id, 'position' => 0])->assertRedirect();

    $task->refresh();
    expect($task->column_id)->toBe($done->id)->and($task->position)->toBe(0);
    expect(Task::where('number', 2)->first()->position)->toBe(1);
    expect(TaskActivity::where('task_id', $task->id)->value('text'))->toContain('moved the task from');
});

test('a comment with an upload shows in the drawer and is stored privately', function () {
    Storage::fake('local');
    ['member' => $member, 'task' => $task] = workFixture();

    $this->actingAs($member)->post(route('work.tasks.comments', $task), [
        'body' => 'Looks good', 'files' => [UploadedFile::fake()->image('shot.png')],
    ])->assertRedirect();

    $this->actingAs($member)->get(route('work.board', $task->project).'?task=PULSE-1')
        ->assertInertia(fn ($page) => $page->has('task.comments', 1)->has('task.attachments', 1)->has('task.activity', 1));
});

test('projects list shows only visible projects and my tasks lists assigned work', function () {
    ['member' => $member, 'outsider' => $outsider] = workFixture();

    $this->actingAs($member)->get(route('work.projects'))->assertInertia(fn ($p) => $p->component('Work/ProjectsPage')->has('projects', 1)->where('can_create', false));
    $this->actingAs($outsider)->get(route('work.projects'))->assertInertia(fn ($p) => $p->has('projects', 0));
    $this->actingAs($member)->get(route('work.my-tasks'))->assertInertia(fn ($p) => $p->component('Work/MyTasksPage')->has('tasks', 1));
});

test('team leads create projects with default columns', function () {
    $lead = makeUser('team_lead');

    $this->actingAs($lead)->post(route('work.projects.store'), ['name' => 'Apex', 'key' => 'apx', 'billing_type' => 'internal'])->assertRedirect();
    $p = Project::where('key', 'APX')->firstOrFail();
    expect(BoardColumn::where('project_id', $p->id)->count())->toBe(5);
    $this->actingAs($lead)->post(route('work.projects.store'), ['name' => 'Dup', 'key' => 'APX', 'billing_type' => 'internal'])
        ->assertSessionHasErrors(['key' => 'That key is already used.']);
});
