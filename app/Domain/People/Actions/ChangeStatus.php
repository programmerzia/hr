<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;
use Illuminate\Validation\ValidationException;

class ChangeStatus
{
    public function __invoke(Employee $employee, string $status, string $effectiveOn): Employee
    {
        if ($employee->status === $status) {
            throw ValidationException::withMessages(['effective_on' => 'Already in this status']);
        }
        $exiting = in_array($status, ['resigned', 'terminated'], true);
        $old = $employee->status;
        $employee->forceFill([
            'status' => $status,
            'exited_on' => $exiting ? $effectiveOn : null,
            'probation_until' => $status === 'probation' ? $employee->probation_until : null,
        ])->save();
        Concerns::event(
            $employee,
            'status',
            'Status changed from '.str_replace('_', ' ', $old).' to '.str_replace('_', ' ', $status).($exiting ? '. Sign-in disabled' : ''),
            $effectiveOn,
        );

        return $employee;
    }
}
