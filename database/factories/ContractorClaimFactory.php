<?php

namespace Database\Factories;

use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContractorClaimFactory extends Factory
{
    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory()->state(['employment_type' => 'contractor']),
            'year' => 2026,
            'month' => fake()->unique()->numberBetween(1, 12),
            'tracked_minutes' => 9600,
            'claimed_minutes' => 9600,
            'rate' => 1200,
            'total' => 192000,
            'status' => 'draft',
        ];
    }
}
