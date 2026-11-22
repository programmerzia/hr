<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Attendance\Actions\RegradeDays;
use App\Domain\Leave\Services\BalanceService;
use App\Domain\Leave\Services\PayrollGuard;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class Cancel
{
    public function __construct(private BalanceService $balances, private RegradeDays $regrade) {}

    public function __invoke(LeaveRequest $request): LeaveRequest
    {
        return DB::transaction(function () use ($request) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            if (in_array($r->status, ['pending_lead', 'pending_hr'], true)) {
                $this->balances->adjust($r, pending: -(float) $r->days);
            } elseif ($r->status === 'approved' && $r->starts_on->format('Y-m-d') > now()->format('Y-m-d')) {
                PayrollGuard::assertOpen($r->starts_on->format('Y-m-d'), $r->ends_on->format('Y-m-d'));
                $this->balances->adjust($r, used: -(float) $r->days);
                $wasApproved = true;
            } else {
                Fail::with('This request can no longer be cancelled');
            }
            $r->update(['status' => 'cancelled']);
            if ($wasApproved ?? false) {
                $this->regrade->__invoke($r->employee_id, $r->starts_on->format('Y-m-d'), $r->ends_on->format('Y-m-d'));
            }

            return $r;
        });
    }
}
