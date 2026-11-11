<?php

namespace App\Domain\Payroll\Support;

use App\Models\PayrollRun;
use App\Models\User;

final class Badges
{
    /** Runs awaiting the viewer: review for approvers, draft for HR. @return array{payroll: int} */
    public static function for(User $user): array
    {
        $status = match ($user->role) {
            'management' => 'review',
            'hr' => 'draft',
            default => null,
        };

        return ['payroll' => $status ? PayrollRun::where('status', $status)->count() : 0];
    }
}
