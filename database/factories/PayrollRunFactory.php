<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PayrollRunFactory extends Factory
{
    public function definition(): array
    {
        return [
            'year' => 2026,
            'month' => fake()->unique()->numberBetween(1, 12),
            'status' => 'draft',
        ];
    }
}
