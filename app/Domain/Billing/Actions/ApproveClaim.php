<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\ClaimNotifier;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;
use App\Models\Employee;

class ApproveClaim
{
    public function __construct(private ClaimNotifier $notifier) {}

    public function __invoke(ContractorClaim $claim, Employee $by): ContractorClaim
    {
        if ($claim->status !== 'verified') {
            Fail::with('Only verified claims can be approved');
        }
        $claim->update(['status' => 'approved', 'approved_by' => $by->id]);
        Audit::log('claim', $claim->id, 'approved the claim', $by->id);
        $this->notifier->approved($claim);

        return $claim;
    }
}
