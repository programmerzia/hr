<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\ClaimNotifier;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;

class PayClaim
{
    public function __construct(private ClaimNotifier $notifier) {}

    public function __invoke(ContractorClaim $claim, ?string $paidOn, ?string $reference, ?string $actorId): ContractorClaim
    {
        if ($claim->status !== 'approved') {
            Fail::with('Only approved claims can be paid');
        }
        if (! $paidOn) {
            Fail::with('Payment date is required');
        }
        $ref = trim((string) $reference);
        $claim->update(['status' => 'paid', 'paid_at' => $paidOn.' 12:00:00']);
        Audit::log('claim', $claim->id, 'marked the claim as paid'.($ref !== '' ? " (ref {$ref})" : ''), $actorId, ['paid_on' => $paidOn, 'reference' => $ref ?: null]);
        $this->notifier->paid($claim);

        return $claim;
    }
}
