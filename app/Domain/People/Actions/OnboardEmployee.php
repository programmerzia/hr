<?php

namespace App\Domain\People\Actions;

use App\Models\BankAccount;
use App\Models\Employee;
use App\Models\OnboardingChecklistItem;
use App\Models\SalaryStructure;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class OnboardEmployee
{
    public function __invoke(array $p): Employee
    {
        return DB::transaction(function () use ($p) {
            $next = self::nextNumber();
            $employee = Employee::create([
                'code' => "VIV-{$next}",
                'name' => trim($p['name']),
                'email' => trim($p['email']),
                'department_id' => $p['department_id'],
                'team_id' => $p['team_id'] ?? null,
                'designation' => trim($p['designation']),
                'employment_type' => $p['employment_type'],
                'status' => ! empty($p['probation_until']) ? 'probation' : 'active',
                'joined_on' => $p['joined_on'],
                'probation_until' => $p['probation_until'] ?? null,
                'phone' => trim($p['phone']),
                'nid' => trim($p['nid']),
            ]);
            $user = User::create([
                'name' => $employee->name,
                'email' => $employee->email,
                'password' => Concerns::TEMP_PASSWORD,
                'must_change_password' => true,
                'role' => $p['role'],
                'employee_id' => $employee->id,
            ]);
            $employee->forceFill(['user_id' => $user->id])->save();
            Concerns::setTeam($employee, $employee->team_id);

            if (! empty($p['salary'])) {
                $this->salary($employee, $p['salary']);
            }
            if (! empty($p['bank'])) {
                BankAccount::create(['employee_id' => $employee->id, 'is_primary' => true, ...$p['bank']]);
            }
            foreach ($p['checklist'] ?? [] as $label) {
                OnboardingChecklistItem::create(['employee_id' => $employee->id, 'label' => $label, 'done' => false]);
            }
            Concerns::event($employee, 'joined', 'Joined as '.mb_strtolower($employee->designation), $p['joined_on']);

            return $employee;
        });
    }

    private function salary(Employee $employee, array $s): void
    {
        $gross = Concerns::gross($s);
        SalaryStructure::create([
            'employee_id' => $employee->id,
            'effective_from' => $s['effective_from'] ?? $employee->joined_on,
            'basic' => $s['basic'], 'house_rent' => $s['house_rent'], 'medical' => $s['medical'], 'conveyance' => $s['conveyance'],
            'pf_percent' => $s['pf_percent'], 'tax_monthly' => $s['tax_monthly'],
            'gross' => $gross,
            'hourly_rate' => $s['hourly_rate'] ?? (int) round($gross / 22 / 8),
        ]);
    }

    /** Next free VIV-NNN number (never below 101). */
    public static function nextNumber(): int
    {
        $max = Employee::pluck('code')
            ->map(fn ($c) => (int) preg_replace('/\D/', '', $c))
            ->max();

        return max(100, (int) $max) + 1;
    }
}
