<?php

namespace App\Http\Controllers\Work;

use App\Domain\Work\Actions\CreateProject;
use App\Domain\Work\Actions\ManageProject;
use App\Domain\Work\WorkData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Work\ProjectManageRequest;
use App\Http\Requests\Work\StoreProjectRequest;
use App\Http\Requests\Work\UpdateProjectRequest;
use App\Models\BoardColumn;
use App\Models\Employee;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $projects = WorkData::visibleProjects($user)->with('client')->get();
        $ids = $projects->pluck('id');
        $members = ProjectMember::whereIn('project_id', $ids)->get()->groupBy('project_id');
        $done = BoardColumn::where('is_done', true)->pluck('id');
        $open = Task::whereIn('project_id', $ids)->whereNotIn('column_id', $done)
            ->selectRaw('project_id, count(*) as n')->groupBy('project_id')->pluck('n', 'project_id');
        $canCreate = $user->can('create', Project::class);

        $rows = $projects->map(fn ($p) => [
            ...WorkData::projectRow($p),
            'member_ids' => ($members[$p->id] ?? collect())->pluck('employee_id')->values()->all(),
            'open_tasks' => (int) ($open[$p->id] ?? 0),
        ])->values()->all();

        return Inertia::render('Work/ProjectsPage', [
            'projects' => $rows,
            'clients' => WorkData::clients(),
            'can_create' => $canCreate,
            'lead_options' => $canCreate ? WorkData::people(User::whereIn('role', ['team_lead', 'management'])->orWhere('employee_id', $user->employee_id)
                ->pluck('employee_id')->filter()->pipe(fn ($c) => Employee::whereIn('id', $c)->whereNotIn('status', ['resigned', 'terminated'])->pluck('id'))) : [],
            'people' => WorkData::people(collect($rows)->flatMap(fn ($r) => [...$r['member_ids'], $r['lead_employee_id']])),
        ]);
    }

    public function store(StoreProjectRequest $request, CreateProject $create): RedirectResponse
    {
        $project = $create($request->validated());

        return redirect()->route('work.board', $project)->with('success', 'Project created.');
    }

    public function update(UpdateProjectRequest $request, Project $project, ManageProject $manage): RedirectResponse
    {
        $manage->update($project, $request->validated());

        return back();
    }

    public function addMember(ProjectManageRequest $request, Project $project, ManageProject $manage): RedirectResponse
    {
        $manage->addMember($project, $request->validated('employee_id'));

        return back();
    }

    public function removeMember(Request $request, Project $project, Employee $employee, ManageProject $manage): RedirectResponse
    {
        Gate::authorize('manage', $project);

        return $manage->removeMember($project, $employee->id) ? back() : back()->with('error', 'The project lead cannot be removed.');
    }

    public function addColumn(ProjectManageRequest $request, Project $project, ManageProject $manage): RedirectResponse
    {
        $manage->addColumn($project, $request->validated('name'));

        return back();
    }

    public function renameColumn(ProjectManageRequest $request, BoardColumn $column, ManageProject $manage): RedirectResponse
    {
        $manage->renameColumn($column, $request->validated('name'));

        return back();
    }

    public function reorderColumns(ProjectManageRequest $request, Project $project, ManageProject $manage): RedirectResponse
    {
        $manage->reorderColumns($project, $request->validated('ids'));

        return back();
    }
}
