<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveTypeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement(['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity']),
            'annual_quota' => 10,
            'is_paid' => true,
            'carry_forward' => false,
            'allows_half_day' => true,
        ];
    }
}
