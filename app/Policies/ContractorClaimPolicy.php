<?php

namespace App\Policies;

use App\Models\ContractorClaim;
use App\Models\User;
use App\Support\Abilities;

class ContractorClaimPolicy
{
    /** Contractors, team leads (their team), HR and management. */
    public function viewAny(User $user): bool
    {
        return $user->employee?->employment_type === 'contractor'
            || in_array($user->role, ['team_lead', 'hr', 'management'], true);
    }

    public function view(User $user, ContractorClaim $claim): bool
    {
        if ($claim->employee_id === $user->employee_id || in_array($user->role, ['hr', 'management'], true)) {
            return true;
        }

        return $user->role === 'team_lead' && (bool) $user->employee?->leads($claim->employee()->firstOrFail());
    }

    public function update(User $user, ContractorClaim $claim): bool
    {
        return $claim->employee_id === $user->employee_id;
    }

    public function submit(User $user, ContractorClaim $claim): bool
    {
        return $claim->employee_id === $user->employee_id;
    }

    /** The contractor's own team lead. */
    public function verify(User $user, ContractorClaim $claim): bool
    {
        return Abilities::can($user->role, 'verify_claims')
            && $claim->employee_id !== $user->employee_id
            && (bool) $user->employee?->leads($claim->employee()->firstOrFail());
    }

    public function approve(User $user, ContractorClaim $claim): bool
    {
        return Abilities::can($user->role, 'approve_claims') && $claim->employee_id !== $user->employee_id;
    }

    public function pay(User $user, ContractorClaim $claim): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    public function generateFor(User $user): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    /** The one step the viewer can take on this claim right now, for the action button. */
    public function next(User $user, ContractorClaim $claim): ?string
    {
        return match ($claim->status) {
            'draft' => $this->submit($user, $claim) ? 'submit' : null,
            'submitted' => $this->verify($user, $claim) ? 'verify' : null,
            'verified' => $this->approve($user, $claim) ? 'approve' : null,
            'approved' => $this->pay($user, $claim) ? 'pay' : null,
            default => null,
        };
    }
}
