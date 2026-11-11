<?php

namespace App\Domain\People\Actions;

use App\Models\BankAccount;
use App\Models\Employee;

class UpdateBankAccount
{
    public function __invoke(Employee $employee, array $patch): BankAccount
    {
        $bank = BankAccount::where('employee_id', $employee->id)->where('is_primary', true)->first();
        if ($bank) {
            $bank->update($patch);

            return $bank;
        }

        return BankAccount::create(['employee_id' => $employee->id, 'is_primary' => true, ...$patch]);
    }
}
