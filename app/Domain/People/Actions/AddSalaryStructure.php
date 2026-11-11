<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use App\Models\SalaryStructure;
use Illuminate\Validation\ValidationException;

class AddSalaryStructure
{
    public function __invoke(Employee $employee, array $input): SalaryStructure
    {
        $latest = SalaryStructure::where('employee_id', $employee->id)->max('effective_from');
        if ($latest && $input['effective_from'] <= substr((string) $latest, 0, 10)) {
            throw ValidationException::withMessages(['effective_from' => 'Effective date must be after the current structure']);
        }
        $gross = Concerns::gross($input);

        return SalaryStructure::create([
            'employee_id' => $employee->id,
            'effective_from' => $input['effective_from'],
            'basic' => $input['basic'], 'house_rent' => $input['house_rent'], 'medical' => $input['medical'], 'conveyance' => $input['conveyance'],
            'pf_percent' => $input['pf_percent'], 'tax_monthly' => $input['tax_monthly'],
            'gross' => $gross,
            'hourly_rate' => $input['hourly_rate'] ?? (int) round($gross / 22 / 8),
        ]);
    }
}
