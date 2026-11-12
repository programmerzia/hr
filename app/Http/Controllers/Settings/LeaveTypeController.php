<?php

namespace App\Http\Controllers\Settings;

use App\Domain\Settings\SettingsLog;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\LeaveTypeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeaveTypeController extends Controller
{
    public function index(): Response
    {
        $used = LeaveRequest::select('leave_type_id')->distinct()->pluck('leave_type_id')
            ->merge(LeaveBalance::select('leave_type_id')->distinct()->pluck('leave_type_id'))->flip();

        return Inertia::render('Settings/LeaveTypesPage', [
            'leave_types' => LeaveType::orderBy('created_at')->orderBy('name')->get()->map(fn (LeaveType $t) => [
                'id' => $t->id, 'name' => $t->name, 'annual_quota' => (float) $t->annual_quota,
                'is_paid' => (bool) $t->is_paid, 'carry_forward' => (bool) $t->carry_forward,
                'allows_half_day' => (bool) $t->allows_half_day,
                'carry_forward_cap' => $t->carry_forward_cap === null ? null : (float) $t->carry_forward_cap,
                'allowed_on_probation' => (bool) $t->allowed_on_probation,
                'encashable' => (bool) $t->encashable,
                'in_use' => $used->has($t->id),
            ])->all(),
            'history' => SettingsLog::recent('leave-types'),
        ]);
    }

    public function store(LeaveTypeRequest $request): RedirectResponse
    {
        $type = LeaveType::create($request->validated());
        SettingsLog::record($request->user(), 'leave-types', "added leave type {$type->name}", subjectId: $type->id);

        return back()->with('success', 'Leave type added');
    }

    public function update(LeaveTypeRequest $request, LeaveType $leaveType): RedirectResponse
    {
        $leaveType->update($request->validated());
        SettingsLog::record($request->user(), 'leave-types', "updated leave type {$leaveType->name}", subjectId: $leaveType->id);

        return back()->with('success', 'Leave type updated');
    }

    public function destroy(Request $request, LeaveType $leaveType): RedirectResponse
    {
        if (LeaveRequest::where('leave_type_id', $leaveType->id)->exists() || LeaveBalance::where('leave_type_id', $leaveType->id)->exists()) {
            return back()->with('error', "{$leaveType->name} already has requests or balances and cannot be deleted.");
        }
        $leaveType->delete();
        SettingsLog::record($request->user(), 'leave-types', "deleted leave type {$leaveType->name}", subjectId: $leaveType->id);

        return back()->with('success', 'Leave type deleted');
    }
}
