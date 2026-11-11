<?php

namespace App\Domain\Billing\Support;

use App\Domain\Billing\Services\ClaimScope;
use App\Models\ContractorClaim;
use App\Models\User;

final class Badges
{
    /** @return array{claims: int, 'my-claims': int} */
    public static function for(User $user): array
    {
        $mine = $user->employee?->employment_type === 'contractor'
            ? ContractorClaim::where('employee_id', $user->employee_id)->where('status', 'draft')->count()
            : 0;

        return ['claims' => ClaimScope::awaiting($user)->count(), 'my-claims' => $mine];
    }
}
