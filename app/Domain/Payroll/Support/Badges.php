<?php

namespace App\Domain\Payroll\Support;

use App\Models\PayrollRun;
use App\Models\User;

final class Badges
{
    /** Runs awaiting the viewer: review for approve_payroll holders, draft for manage_payroll holders who cannot approve. @return array{payroll: int} */
    public static function for(User $user): array
    {
        // Approvers wait on runs in review; people who only prepare runs wait on drafts.
        $approves = $user->checkPermissionTo('approve_payroll');
        $statuses = array_values(array_filter([
            $approves ? 'review' : null,
            ! $approves && $user->checkPermissionTo('manage_payroll') ? 'draft' : null,
        ]));

        return ['payroll' => $statuses ? PayrollRun::whereIn('status', $statuses)->count() : 0];
    }
}
