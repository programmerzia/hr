<?php

namespace Database\Factories;

use App\Models\BoardColumn;
use App\Models\Employee;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

class TaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'number' => fake()->unique()->numberBetween(1, 99999),
            'title' => fake()->sentence(4),
            'body_md' => '',
            'column_id' => fn (array $a) => BoardColumn::factory()->create(['project_id' => $a['project_id']])->id,
            'priority' => 'medium',
            'reporter_id' => Employee::factory(),
            'position' => 0,
        ];
    }
}
