<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Fail;
use App\Models\Client;

class UpdateClient
{
    public function __invoke(Client $client, array $data): Client
    {
        if (array_key_exists('name', $data) && trim((string) $data['name']) === '') {
            Fail::with('Name is required');
        }
        $patch = [];
        foreach (['name', 'email'] as $k) {
            if (array_key_exists($k, $data)) {
                $patch[$k] = trim((string) $data[$k]);
            }
        }
        foreach (['address', 'currency'] as $k) {
            if (array_key_exists($k, $data)) {
                $patch[$k] = (string) $data[$k];
            }
        }
        if (array_key_exists('default_rate', $data)) {
            $patch['default_rate'] = (int) $data['default_rate'];
        }
        $client->update($patch);

        return $client;
    }
}
