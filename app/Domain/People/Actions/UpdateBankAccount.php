<?php

namespace App\Domain\People\Actions;

use App\Models\BankAccount;
use App\Models\Employee;

class UpdateBankAccount
{
    public function __invoke(Employee $employee, array $patch): BankAccount
    {
        $bank = BankAccount::where('employee_id', $employee->id)->where('is_primary', true)->first();
        $fields = ['bank', 'branch', 'account_name', 'account_no', 'routing_no'];
        $mask = fn (?string $v) => $v === null || $v === '' ? $v : '****'.substr($v, -4);
        $before = $bank ? $bank->only($fields) : [];
        $bank ? $bank->update($patch) : ($bank = BankAccount::create(['employee_id' => $employee->id, 'is_primary' => true, ...$patch]));
        $diff = Concerns::diff($before, $bank->only($fields));
        foreach (['account_no', 'routing_no'] as $secret) {
            if (isset($diff[$secret])) {
                $diff[$secret] = ['from' => $mask($diff[$secret]['from']), 'to' => $mask($diff[$secret]['to'])];
            }
        }
        if ($diff) {
            Concerns::audit($employee, ($before ? 'Updated bank account. ' : 'Added bank account. ').Concerns::describe($diff), ['changes' => $diff]);
        }

        return $bank;
    }
}
