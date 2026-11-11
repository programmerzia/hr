<?php

namespace Database\Factories;

use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProjectFactory extends Factory
{
    public function definition(): array
    {
        return [
            'key' => strtoupper(fake()->unique()->lexify('???')),
            'name' => fake()->words(2, true),
            'client_id' => null,
            'lead_employee_id' => Employee::factory(),
            'status' => 'active',
            'billing_type' => 'internal',
        ];
    }
}
