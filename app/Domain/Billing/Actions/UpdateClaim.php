<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;

class UpdateClaim
{
    /** @param array{claimed_minutes?: int, fixed_amount?: ?int} $patch */
    public function __invoke(ContractorClaim $claim, array $patch, ?string $actorId): ContractorClaim
    {
        if ($claim->status !== 'draft') {
            Fail::with('Only draft claims can be edited');
        }
        $claimed = (int) ($patch['claimed_minutes'] ?? $claim->claimed_minutes);
        $fixed = array_key_exists('fixed_amount', $patch) ? ($patch['fixed_amount'] === null ? null : (int) $patch['fixed_amount']) : $claim->fixed_amount;
        if ($claimed < 0 || ($fixed !== null && $fixed < 0)) {
            Fail::with('Values cannot be negative');
        }
        $claim->update(['claimed_minutes' => $claimed, 'fixed_amount' => $fixed, 'total' => GenerateClaim::total($claimed, $claim->rate, $fixed)]);
        Audit::log('claim', $claim->id, 'edited the draft', $actorId);

        return $claim;
    }
}
