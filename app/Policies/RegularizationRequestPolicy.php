<?php

namespace App\Policies;

use App\Domain\Attendance\Services\Scope;
use App\Models\RegularizationRequest;
use App\Models\User;

class RegularizationRequestPolicy
{
    /** Lead scope or HR/management, never the requester, never a plain employee. */
    public function decide(User $user, RegularizationRequest $req): bool
    {
        return $req->status === 'pending' && in_array($req->employee_id, Scope::decideIds($user), true);
    }
}
