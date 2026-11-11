<?php

namespace App\Domain\People\Actions;

use App\Models\Employee;

class ResetPassword
{
    /** Issues the temporary password and forces a change at next sign-in. */
    public function __invoke(Employee $employee): string
    {
        Concerns::userOf($employee)?->forceFill(['password' => Concerns::TEMP_PASSWORD, 'must_change_password' => true])->save();

        return Concerns::TEMP_PASSWORD;
    }
}
