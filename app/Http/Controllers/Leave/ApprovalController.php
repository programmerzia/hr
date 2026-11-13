<?php

namespace App\Http\Controllers\Leave;

use App\Domain\Leave\Actions\ApproveAsHr;
use App\Domain\Leave\Actions\ApproveAsLead;
use App\Domain\Leave\Actions\Fail;
use App\Domain\Leave\Actions\Reject;
use App\Domain\Leave\Services\ApprovalScope;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Support\Shape;
use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\DecideLeaveRequest;
use App\Http\Resources\LeaveApprovalResource;
use App\Http\Resources\LeaveRequestResource;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalController extends Controller
{
    private const ACTIVE = ['pending_lead', 'pending_hr', 'approved'];

    public function index(Request $request, BalanceService $balances): Response
    {
        abort_unless(Gate::any(['approve_leave_lead', 'approve_leave_hr']), 403);
        $queue = ApprovalScope::pending($request->user())->orderByDesc('created_at')->get();
        $approvals = LeaveApproval::whereIn('leave_request_id', $queue->pluck('id'))->orderBy('decided_at')->get()->groupBy('leave_request_id');

        $items = $queue->map(function (LeaveRequest $r) use ($balances, $approvals) {
            $bal = $balances->find($r->employee_id, $r->leave_type_id, (int) $r->starts_on->format('Y'));

            return [
                'request' => LeaveRequestResource::make($r)->resolve(),
                'overlaps' => LeaveRequestResource::collection($this->overlaps($r))->resolve(),
                'balance' => $bal ? Shape::balance($bal) : null,
                // Pending days are already reserved, so approving does not change what is available.
                'balance_after' => $bal ? ($bal['unlimited'] ? null : $bal['available']) : 0,
                'history' => LeaveApprovalResource::collection($approvals[$r->id] ?? collect())->resolve(),
            ];
        })->values();

        $overlapRequests = $items->pluck('overlaps')->flatten(1);
        $ids = $queue->pluck('employee_id')
            ->merge($overlapRequests->pluck('employee_id'))
            ->merge($approvals->flatten()->pluck('decided_by'))->unique()->values();

        return Inertia::render('Leave/ApprovalsPage', [
            'items' => $items,
            'people' => Shape::people($ids),
            'leave_types' => Shape::types(),
            'scope' => in_array($request->user()->role, ['hr', 'management'], true) ? 'hr' : 'lead',
        ]);
    }

    public function approve(DecideLeaveRequest $form, LeaveRequest $leaveRequest, ApproveAsLead $lead, ApproveAsHr $hr): RedirectResponse
    {
        $user = $form->user();
        Gate::authorize('decide', $leaveRequest);
        $note = $form->validated('note');
        match ($leaveRequest->status) {
            // HR/management stepping in for a lead approves straight through.
            'pending_lead' => in_array($user->role, ['hr', 'management'], true) && ! $user->employee?->leads($leaveRequest->employee()->first())
                ? $hr($lead($leaveRequest, $user->employee, $note), $user->employee, $note)
                : $lead($leaveRequest, $user->employee, $note),
            'pending_hr' => $hr($leaveRequest, $user->employee, $note),
            default => Fail::with('This request is not waiting for a decision'),
        };

        return back()->with('success', 'Leave request approved');
    }

    public function reject(DecideLeaveRequest $form, LeaveRequest $leaveRequest, Reject $reject): RedirectResponse
    {
        Gate::authorize('decide', $leaveRequest);
        $reject($leaveRequest, $form->user()->employee, $form->validated('note'));

        return back()->with('success', 'Leave request rejected');
    }

    /** Teammates (same team) with active leave overlapping the request. */
    private function overlaps(LeaveRequest $r)
    {
        $teamId = Employee::whereKey($r->employee_id)->value('team_id');
        if (! $teamId) {
            return collect();
        }
        $mates = Employee::where('team_id', $teamId)->where('id', '!=', $r->employee_id)->pluck('id');

        return LeaveRequest::whereIn('employee_id', $mates)->whereIn('status', self::ACTIVE)
            ->whereDate('starts_on', '<=', $r->ends_on)->whereDate('ends_on', '>=', $r->starts_on)->get();
    }
}
