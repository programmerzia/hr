<?php

namespace App\Domain\Leave\Support;

use App\Domain\Leave\Services\ApprovalScope;
use App\Models\User;

final class Badges
{
    /** @return array{'leave-approvals': int} */
    public static function for(User $user): array
    {
        return ['leave-approvals' => ApprovalScope::pending($user)->count()];
    }
}
