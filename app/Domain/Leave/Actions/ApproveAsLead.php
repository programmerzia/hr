<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class ApproveAsLead
{
    public function __construct(private LeaveNotifier $notifier) {}

    public function __invoke(LeaveRequest $request, ?Employee $decider, ?string $note = null): LeaveRequest
    {
        return DB::transaction(function () use ($request, $decider, $note) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            if ($r->status !== 'pending_lead') {
                Fail::with('This request is not waiting for a lead');
            }
            if ($r->employee_id === $decider?->id) {
                Fail::with('You cannot approve your own request');
            }
            LeaveApproval::create([
                'leave_request_id' => $r->id, 'stage' => 'lead', 'decided_by' => $decider?->id,
                'decision' => 'approved', 'note' => trim((string) $note) ?: null, 'decided_at' => now(),
            ]);
            $r->update(['status' => 'pending_hr']);
            $this->notifier->toNextDecider($r);

            return $r;
        });
    }
}
