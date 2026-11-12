<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use App\Support\Abilities;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return Abilities::has($user, 'manage_billing');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }

    public function send(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }

    public function pay(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }

    public function void(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }
}
