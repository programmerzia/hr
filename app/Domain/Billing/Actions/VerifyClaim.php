<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\ClaimNotifier;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;
use App\Models\Employee;

class VerifyClaim
{
    public function __construct(private ClaimNotifier $notifier) {}

    public function __invoke(ContractorClaim $claim, Employee $lead): ContractorClaim
    {
        if ($claim->status !== 'submitted') {
            Fail::with('Only submitted claims can be verified');
        }
        if (! $lead->leads($claim->employee()->firstOrFail())) {
            Fail::with('Only the contractor’s team lead can verify');
        }
        $claim->update(['status' => 'verified', 'verified_by' => $lead->id]);
        Audit::log('claim', $claim->id, 'verified the hours', $lead->id);
        $this->notifier->verified($claim);

        return $claim;
    }
}
