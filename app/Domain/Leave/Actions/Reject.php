<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class Reject
{
    public function __construct(private BalanceService $balances, private LeaveNotifier $notifier) {}

    /** The stage is the request's current pending stage. */
    public function __invoke(LeaveRequest $request, ?Employee $decider, ?string $note): LeaveRequest
    {
        return DB::transaction(function () use ($request, $decider, $note) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            if (! in_array($r->status, ['pending_lead', 'pending_hr'], true)) {
                Fail::with('This request is not at that stage');
            }
            if ($r->employee_id === $decider?->id) {
                Fail::with('You cannot reject your own request');
            }
            $note = trim((string) $note);
            if ($note === '') {
                Fail::with('Add a reason for rejecting');
            }
            LeaveApproval::create([
                'leave_request_id' => $r->id, 'stage' => $r->status === 'pending_lead' ? 'lead' : 'hr',
                'decided_by' => $decider?->id, 'decision' => 'rejected', 'note' => $note, 'decided_at' => now(),
            ]);
            $r->update(['status' => 'rejected']);
            $this->balances->adjust($r, pending: -(float) $r->days);
            $this->notifier->toRequester($r, 'Leave rejected', $note);

            return $r;
        });
    }
}
