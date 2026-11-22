<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\LeaveNotifier;
use App\Domain\Leave\Services\PayrollGuard;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class ApproveAsHr
{
    public function __construct(private BalanceService $balances, private LeaveNotifier $notifier, private RegradeDays $regrade) {}

    public function __invoke(LeaveRequest $request, ?Employee $decider, ?string $note = null, bool $onBehalfOfLead = false): LeaveRequest
    {
        return DB::transaction(function () use ($request, $decider, $note, $onBehalfOfLead) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            $waiting = $onBehalfOfLead ? ['pending_hr', 'pending_lead'] : ['pending_hr'];
            if (! in_array($r->status, $waiting, true)) {
                Fail::with('This request is not waiting for HR');
            }
            if ($r->employee_id === $decider?->id) {
                Fail::with('You cannot approve your own request');
            }
            PayrollGuard::assertOpen($r->starts_on->format('Y-m-d'), $r->ends_on->format('Y-m-d'));
            $note = trim((string) $note);
            if ($onBehalfOfLead && $r->status === 'pending_lead') {
                $note = trim('Approved on behalf of lead. '.$note);
            }
            LeaveApproval::create([
                'leave_request_id' => $r->id, 'stage' => 'hr', 'decided_by' => $decider?->id,
                'decision' => 'approved', 'note' => $note ?: null, 'decided_at' => now(),
            ]);
            $r->update(['status' => 'approved']);
            $this->balances->adjust($r, used: (float) $r->days, pending: -(float) $r->days);
            $this->regrade->__invoke($r->employee_id, $r->starts_on->format('Y-m-d'), $r->ends_on->format('Y-m-d'));
            $this->notifier->toRequester($r, 'Leave approved');

            return $r;
        });
    }
}
