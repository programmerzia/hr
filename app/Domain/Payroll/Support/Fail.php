<?php

namespace App\Domain\Payroll\Support;

use Illuminate\Validation\ValidationException;

/** Domain failures surface as a validation error on the `payroll` key (the mock's Result error text). */
final class Fail
{
    public static function with(string $message): never
    {
        throw ValidationException::withMessages(['payroll' => $message]);
    }
}
