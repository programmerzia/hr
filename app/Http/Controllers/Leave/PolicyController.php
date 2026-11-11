<?php

namespace App\Http\Controllers\Leave;

use App\Domain\Leave\Support\Shape;
use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\UpdateLeaveTypeRequest;
use App\Models\LeaveType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PolicyController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('manage_settings');

        return Inertia::render('Leave/PolicyPage', ['leave_types' => Shape::types()]);
    }

    public function update(UpdateLeaveTypeRequest $request, LeaveType $leaveType): RedirectResponse
    {
        $leaveType->update($request->validated());

        return back()->with('success', 'Leave policy updated');
    }
}
