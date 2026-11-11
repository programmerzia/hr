<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\DecideRegularization;
use App\Domain\Attendance\Actions\RequestRegularization;
use App\Domain\Attendance\Services\Scope;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\DecideRegularizationRequest;
use App\Http\Requests\Attendance\StoreRegularizationRequest;
use App\Http\Resources\AttendanceDayResource;
use App\Http\Resources\RegularizationRequestResource;
use App\Models\AttendanceDay;
use App\Models\Employee;
use App\Models\RegularizationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class RegularizationController extends Controller
{
    public function index(Request $request): Response
    {
        $ids = Scope::decideIds($request->user());
        $reqs = RegularizationRequest::with(['employee', 'day'])->whereIn('employee_id', $ids)->latest()->get()
            ->sortBy(fn ($r) => $r->status === 'pending' ? 0 : 1)->values();
        $deciders = Employee::whereIn('id', $reqs->pluck('decided_by')->filter())->pluck('name', 'id');

        return Inertia::render('Attendance/RegularizationsPage', [
            'requests' => $reqs->map(fn ($r) => [
                ...RegularizationRequestResource::make($r)->resolve(),
                'person' => ['id' => $r->employee->id, 'name' => $r->employee->name, 'designation' => $r->employee->designation],
                'day' => AttendanceDayResource::make($r->day)->resolve(),
                'decider_name' => $deciders[$r->decided_by] ?? null,
            ])->all(),
        ]);
    }

    public function store(StoreRegularizationRequest $request, RequestRegularization $action): RedirectResponse
    {
        $day = AttendanceDay::findOrFail($request->validated('attendance_day_id'));
        Gate::authorize('request', $day);
        $error = $action($day, $request->validated('reason'));

        return $error ? back()->with('error', $error) : back()->with('success', 'Request sent.');
    }

    public function decide(DecideRegularizationRequest $request, DecideRegularization $action): RedirectResponse
    {
        $req = RegularizationRequest::findOrFail($request->validated('id'));
        Gate::authorize('decide', $req);
        $ok = $action($req, $request->validated('decision'), $request->validated('note'), $request->user()->employee);

        return $ok ? back()->with('success', 'Decision saved.') : back()->with('error', 'This request was already decided.');
    }
}
