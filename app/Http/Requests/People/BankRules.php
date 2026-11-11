<?php

namespace App\Http\Requests\People;

final class BankRules
{
    public static function rules(): array
    {
        return [
            'bank' => ['required', 'string'],
            'branch' => ['required', 'string'],
            'account_name' => ['required', 'string'],
            'account_no' => ['required', 'string'],
            'routing_no' => ['required', 'string'],
        ];
    }
}
