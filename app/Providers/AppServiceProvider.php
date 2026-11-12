<?php

namespace App\Providers;

use App\Models\User;
use App\Support\Access;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach (Access::names() as $ability) {
            Gate::define($ability, fn (User $user) => $user->checkPermissionTo($ability));
        }
        // Composite abilities for route-level guards (any-of). Not part of the editable catalogue.
        foreach ([
            'view_settings' => ['manage_policy', 'manage_access'],
            'payroll_staff' => ['manage_payroll', 'approve_payroll'],
            'leave_approver' => ['approve_leave_lead', 'approve_leave_hr'],
        ] as $name => $any) {
            Gate::define($name, fn (User $user) => collect($any)->contains(fn ($p) => $user->checkPermissionTo($p)));
        }
    }
}
