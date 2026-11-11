<?php

namespace App\Support;

use App\Models\User;

/**
 * Nav badge counts. Each module contributes through App\Domain\<Module>\Support\Badges::for(User): array<string,int>.
 * Keys must match nav item ids (inbox, leave-approvals, regularizations, claims, payroll).
 */
final class Badges
{
    /** @var list<class-string> */
    private const PROVIDERS = [
        \App\Domain\Attendance\Support\Badges::class,
        \App\Domain\Leave\Support\Badges::class,
        \App\Domain\Billing\Support\Badges::class,
        \App\Domain\Payroll\Support\Badges::class,
        \App\Domain\Inbox\Support\Badges::class,
    ];

    /** @return array<string,int> */
    public static function for(?User $user): array
    {
        $out = ['inbox' => 0, 'leave-approvals' => 0, 'regularizations' => 0, 'claims' => 0, 'payroll' => 0];
        if (! $user) {
            return $out;
        }
        foreach (self::PROVIDERS as $provider) {
            if (class_exists($provider)) {
                $out = array_merge($out, $provider::for($user));
            }
        }

        return $out;
    }
}
