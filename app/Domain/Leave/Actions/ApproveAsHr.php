<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class ApproveAsHr
{
    public function __construct(private BalanceService $balances, private LeaveNotifier $notifier) {}

    public function __invoke(LeaveRequest $request, ?Employee $decider, ?string $note = null): LeaveRequest
    {
        return DB::transaction(function () use ($request, $decider, $note) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            if ($r->status !== 'pending_hr') {
                Fail::with('This request is not waiting for HR');
            }
            if ($r->employee_id === $decider?->id) {
                Fail::with('You cannot approve your own request');
            }
            LeaveApproval::create([
                'leave_request_id' => $r->id, 'stage' => 'hr', 'decided_by' => $decider?->id,
                'decision' => 'approved', 'note' => trim((string) $note) ?: null, 'decided_at' => now(),
            ]);
            $r->update(['status' => 'approved']);
            $this->balances->adjust($r, used: (float) $r->days, pending: -(float) $r->days);
            $this->notifier->toRequester($r, 'Leave approved');

            return $r;
        });
    }
}
