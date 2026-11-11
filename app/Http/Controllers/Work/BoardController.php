<?php

namespace App\Http\Controllers\Work;

use App\Domain\Work\WorkData;
use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    public function show(Project $project): RedirectResponse
    {
        return redirect()->route('work.board', $project);
    }

    public function board(Request $request, Project $project): Response
    {
        Gate::authorize('view', $project);

        return Inertia::render('Work/BoardPage', WorkData::projectScreen($project, $request->user(), $request->query('task')));
    }

    public function list(Request $request, Project $project): Response
    {
        Gate::authorize('view', $project);

        return Inertia::render('Work/ListPage', WorkData::projectScreen($project, $request->user(), $request->query('task')));
    }
}
