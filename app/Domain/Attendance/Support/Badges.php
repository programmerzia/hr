<?php

namespace App\Domain\Attendance\Support;

use App\Domain\Attendance\Services\Scope;
use App\Models\RegularizationRequest;
use App\Models\User;

final class Badges
{
    /** @return array{regularizations:int} */
    public static function for(User $user): array
    {
        if ($user->role === 'employee' || ! $user->employee) {
            return ['regularizations' => 0];
        }

        return ['regularizations' => RegularizationRequest::where('status', 'pending')
            ->whereIn('employee_id', Scope::decideIds($user))->count()];
    }
}
