<?php

namespace Database\Factories;

use App\Models\Employee;
use App\Models\LeaveType;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaveRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'employee_id' => Employee::factory(),
            'leave_type_id' => LeaveType::factory(),
            'starts_on' => '2026-11-20',
            'ends_on' => '2026-11-20',
            'half_day' => 'none',
            'days' => 1,
            'reason' => fake()->sentence(),
            'status' => 'pending_lead',
        ];
    }
}
