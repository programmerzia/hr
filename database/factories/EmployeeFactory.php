<?php

namespace Database\Factories;

use App\Models\Department;
use Illuminate\Database\Eloquent\Factories\Factory;

class EmployeeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => 'VIV-'.fake()->unique()->numberBetween(200, 99999),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'department_id' => Department::factory(),
            'team_id' => null,
            'designation' => 'Software engineer',
            'employment_type' => 'full_time',
            'status' => 'active',
            'joined_on' => '2024-01-01',
            'phone' => '+8801700000000',
            'nid' => '1990000000000',
        ];
    }
}
