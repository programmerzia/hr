<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\ClaimNotifier;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Domain\Leave\Services\LeaveNotifier;
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
        $claimant = $claim->employee()->firstOrFail();
        $standIn = LeaveNotifier::leadOf($claimant) === null && (bool) $lead->user?->checkPermissionTo('view_company');
        if (! $lead->leads($claimant) && ! $standIn) {
            Fail::with('Only the contractor’s team lead can verify');
        }
        $claim->update(['status' => 'verified', 'verified_by' => $lead->id]);
        Audit::log('claim', $claim->id, 'verified the hours', $lead->id);
        $this->notifier->verified($claim);

        return $claim;
    }
}
