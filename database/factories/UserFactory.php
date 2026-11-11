<?php

namespace Database\Factories;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'employee',
            'must_change_password' => false,
            'remember_token' => Str::random(10),
        ];
    }

    /** Creates the linked employee record (same name/email) and links both ways. */
    public function withEmployee(array $employee = []): static
    {
        return $this->afterCreating(function (User $user) use ($employee) {
            $e = Employee::factory()->create(['name' => $user->name, 'email' => $user->email, 'user_id' => $user->id, ...$employee]);
            $user->forceFill(['employee_id' => $e->id])->save();
        });
    }

    public function role(string $role): static
    {
        return $this->state(['role' => $role]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }
}
