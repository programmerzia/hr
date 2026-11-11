<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

class ProductionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BaseDataSeeder::class);

        $email = env('SEED_ADMIN_EMAIL');
        $password = env('SEED_ADMIN_PASSWORD');
        if (! $email || ! $password) {
            throw new RuntimeException('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
        }
        if (User::where('email', $email)->exists()) {
            return;
        }
        $dept = Department::firstOrCreate(['name' => 'Operations']);
        $name = env('SEED_ADMIN_NAME', 'HR administrator');
        $employee = Employee::create([
            'code' => 'VIV-100', 'name' => $name, 'email' => $email, 'department_id' => $dept->id,
            'designation' => 'HR manager', 'employment_type' => 'full_time', 'status' => 'active',
            'joined_on' => now()->toDateString(),
        ]);
        $user = User::create([
            'name' => $name, 'email' => $email, 'password' => $password, 'role' => 'hr',
            'employee_id' => $employee->id, 'must_change_password' => true,
        ]);
        $employee->update(['user_id' => $user->id]);
    }
}
