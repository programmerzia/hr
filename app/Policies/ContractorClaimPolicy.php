<?php

namespace App\Policies;

use App\Domain\Leave\Services\LeaveNotifier;
use App\Models\ContractorClaim;
use App\Models\User;
use App\Support\Abilities;

class ContractorClaimPolicy
{
    /** Contractors, team leads (their team), HR and management. */
    public function viewAny(User $user): bool
    {
        return $user->employee?->employment_type === 'contractor'
            || $user->checkPermissionTo('view_company') || $user->checkPermissionTo('verify_claims');
    }

    public function view(User $user, ContractorClaim $claim): bool
    {
        if ($claim->employee_id === $user->employee_id || $user->checkPermissionTo('view_company')) {
            return true;
        }

        return $user->checkPermissionTo('verify_claims') && (bool) $user->employee?->leads($claim->employee()->firstOrFail());
    }

    public function update(User $user, ContractorClaim $claim): bool
    {
        return $claim->employee_id === $user->employee_id;
    }

    public function submit(User $user, ContractorClaim $claim): bool
    {
        return $claim->employee_id === $user->employee_id;
    }

    /** The contractor's own team lead; a view_company holder when nobody leads the contractor. */
    public function verify(User $user, ContractorClaim $claim): bool
    {
        if (! Abilities::has($user, 'verify_claims') || $claim->employee_id === $user->employee_id) {
            return false;
        }
        $claimant = $claim->employee()->firstOrFail();

        return (bool) $user->employee?->leads($claimant)
            || (LeaveNotifier::leadOf($claimant) === null && Abilities::has($user, 'view_company'));
    }

    public function approve(User $user, ContractorClaim $claim): bool
    {
        return Abilities::has($user, 'approve_claims') && $claim->employee_id !== $user->employee_id;
    }

    public function pay(User $user, ContractorClaim $claim): bool
    {
        return Abilities::has($user, 'manage_payroll');
    }

    public function generateFor(User $user): bool
    {
        return Abilities::has($user, 'manage_payroll');
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
