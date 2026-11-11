<?php

namespace Database\Factories;

use App\Models\Conversation;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Factories\Factory;

class MessageFactory extends Factory
{
    public function definition(): array
    {
        return [
            'conversation_id' => Conversation::factory(),
            'author_id' => Employee::factory(),
            'body' => fake()->sentence(),
            'attachments' => [],
        ];
    }
}
