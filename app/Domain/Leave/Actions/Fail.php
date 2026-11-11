<?php

namespace App\Domain\Leave\Actions;

use Illuminate\Validation\ValidationException;

/** Domain failures surface as a validation error on the `leave` key (the mock's Result error text). */
final class Fail
{
    public static function with(string $message): never
    {
        throw ValidationException::withMessages(['leave' => $message]);
    }
}
