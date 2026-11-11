<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Fail;
use App\Models\Client;

class CreateClient
{
    public function __invoke(array $data): Client
    {
        $name = trim((string) ($data['name'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        if ($name === '') {
            Fail::with('Name is required');
        }
        if ($email === '') {
            Fail::with('Email is required');
        }

        return Client::create([
            'name' => $name, 'email' => $email, 'address' => (string) ($data['address'] ?? ''),
            'currency' => $data['currency'], 'default_rate' => (int) ($data['default_rate'] ?? 0),
        ]);
    }
}
