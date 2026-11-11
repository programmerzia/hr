<?php

use App\Models\AttendancePolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/** A user with a linked employee; the attendance policy row is created with defaults. */
function makeUser(string $role = 'employee', array $employee = [], array $user = []): User
{
    AttendancePolicy::current();

    return User::factory()->role($role)->withEmployee($employee)->create($user)->fresh('employee');
}

pest()->extend(TestCase::class)->in('Unit');
