<?php

namespace App\Providers;

use App\Models\User;
use App\Support\Abilities;
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
        foreach (array_keys(Abilities::TABLE) as $ability) {
            Gate::define($ability, fn (User $user) => Abilities::can($user->role, $ability));
        }
    }
}
