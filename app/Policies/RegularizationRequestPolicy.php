<?php

namespace App\Policies;

use App\Domain\Attendance\Services\Scope;
use App\Models\RegularizationRequest;
use App\Models\User;

class RegularizationRequestPolicy
{
    /** Lead scope or HR/management, never the requester, never a plain employee. An already decided request is the action's message, not a 403. */
    public function decide(User $user, RegularizationRequest $req): bool
    {
        return in_array($req->employee_id, Scope::decideIds($user), true);
    }
}
