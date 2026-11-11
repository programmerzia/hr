<?php

namespace App\Domain\Leave\Actions;

use App\Domain\Leave\Services\BalanceService;
use App\Models\LeaveRequest;
use Illuminate\Support\Facades\DB;

class Cancel
{
    public function __construct(private BalanceService $balances) {}

    public function __invoke(LeaveRequest $request): LeaveRequest
    {
        return DB::transaction(function () use ($request) {
            $r = LeaveRequest::lockForUpdate()->findOrFail($request->id);
            if (in_array($r->status, ['pending_lead', 'pending_hr'], true)) {
                $this->balances->adjust($r, pending: -(float) $r->days);
            } elseif ($r->status === 'approved' && $r->starts_on->format('Y-m-d') > now()->format('Y-m-d')) {
                $this->balances->adjust($r, used: -(float) $r->days);
            } else {
                Fail::with('This request can no longer be cancelled');
            }
            $r->update(['status' => 'cancelled']);

            return $r;
        });
    }
}
