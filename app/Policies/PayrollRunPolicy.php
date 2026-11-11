<?php

namespace App\Policies;

use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\User;
use App\Support\Abilities;

class PayrollRunPolicy
{
    private function staff(User $user): bool
    {
        return Abilities::can($user->role, 'manage_payroll') || Abilities::can($user->role, 'approve_payroll');
    }

    public function viewAny(User $user): bool
    {
        return $this->staff($user);
    }

    public function view(User $user, PayrollRun $run): bool
    {
        return $this->staff($user);
    }

    public function manage(User $user, PayrollRun $run): bool
    {
        return Abilities::can($user->role, 'manage_payroll');
    }

    public function approve(User $user, PayrollRun $run): bool
    {
        return Abilities::can($user->role, 'approve_payroll');
    }

    /** Payroll roles see any payslip; an employee sees their own once the run is paid. */
    public function viewPayslip(User $user, PayrollRun $run, PayrollItem $item): bool
    {
        return $this->staff($user) || ($item->employee_id === $user->employee_id && $run->status === 'paid');
    }
}
