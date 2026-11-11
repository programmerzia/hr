<?php

namespace Database\Seeders;

use App\Domain\People\Actions\OnboardEmployee;
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

        $email = config('vivacom.seed_admin_email');
        $password = config('vivacom.seed_admin_password');
        if (! $email || ! $password) {
            throw new RuntimeException('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD');
        }
        if (User::where('email', $email)->exists()) {
            return;
        }
        $dept = Department::firstOrCreate(['name' => 'Operations']);
        $name = config('vivacom.seed_admin_name');
        $employee = Employee::create([
            'code' => 'VIV-'.OnboardEmployee::nextNumber(), 'name' => $name, 'email' => $email, 'department_id' => $dept->id,
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
