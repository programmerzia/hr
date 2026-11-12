<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;
use App\Support\Abilities;

class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return Abilities::has($user, 'manage_billing');
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, Client $client): bool
    {
        return $this->viewAny($user);
    }
}
