<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\ClaimNotifier;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;

class SubmitClaim
{
    public function __construct(private ClaimNotifier $notifier) {}

    public function __invoke(ContractorClaim $claim, ?string $actorId): ContractorClaim
    {
        if ($claim->status !== 'draft') {
            Fail::with('Only draft claims can be submitted');
        }
        if ($claim->claimed_minutes <= 0 && $claim->fixed_amount === null) {
            Fail::with('There are no hours to claim');
        }
        $claim->update(['status' => 'submitted']);
        Audit::log('claim', $claim->id, 'submitted the claim', $actorId);
        $this->notifier->submitted($claim);

        return $claim;
    }
}
