<?php

namespace Database\Factories;

use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvoiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'number' => 'VIV-2026-'.str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'client_id' => Client::factory(),
            'issued_on' => '2026-11-01',
            'due_on' => '2026-11-30',
            'currency' => 'USD',
            'subtotal' => 1000,
            'tax_percent' => 0,
            'discount' => 0,
            'total' => 1000,
            'paid_total' => 0,
            'status' => 'draft',
        ];
    }
}
