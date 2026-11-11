<?php

namespace App\Domain\Billing\Support;

use Illuminate\Validation\ValidationException;

/** Domain failures surface as a validation error on the `billing` key (the mock's Result error text). */
final class Fail
{
    public static function with(string $message): never
    {
        throw ValidationException::withMessages(['billing' => $message]);
    }
}
