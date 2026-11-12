<?php

namespace App\Http\Controllers\Leave;

use App\Domain\Leave\Actions\Cancel;
use App\Domain\Leave\Actions\SubmitLeave;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Support\Shape;
use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\StoreLeaveRequest;
use App\Http\Resources\AttendancePolicyResource;
use App\Http\Resources\HolidayResource;
use App\Http\Resources\LeaveRequestResource;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MyLeaveController extends Controller
{
    public function index(Request $request, BalanceService $balances): Response
    {
        $employee = $request->user()->employee;
        $year = (int) now()->format('Y');
        $rows = array_merge($balances->forEmployee($employee, $year), $balances->forEmployee($employee, $year + 1));

        return Inertia::render('Leave/MyLeavePage', [
            'year' => $year,
            'on_probation' => SubmitLeave::onProbation($employee),
            'balances' => array_map(Shape::balance(...), $rows),
            'requests' => LeaveRequestResource::collection(
                LeaveRequest::where('employee_id', $employee->id)->orderByDesc('starts_on')->orderByDesc('created_at')->get(),
            )->resolve(),
            'leave_types' => Shape::types(),
            'holidays' => HolidayResource::collection(Holiday::orderBy('date')->get())->resolve(),
            'policy' => AttendancePolicyResource::make(AttendancePolicy::current())->resolve(),
        ]);
    }

    public function store(StoreLeaveRequest $request, SubmitLeave $submit): RedirectResponse
    {
        $d = $request->validated();
        $submit(
            $request->user()->employee, $d['leave_type_id'] ?? null, $d['starts_on'] ?? null, $d['ends_on'] ?? null,
            $d['half_day'] ?? 'none', $d['reason'] ?? null, $d['attachment_name'] ?? null,
        );

        return back()->with('success', 'Leave request submitted');
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest, Cancel $cancel): RedirectResponse
    {
        Gate::authorize('cancel', $leaveRequest);
        $cancel($leaveRequest);

        return back()->with('success', 'Leave request cancelled');
    }
}
