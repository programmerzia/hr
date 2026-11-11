<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'claimed_minutes' => 'sometimes|integer|min:0',
            'fixed_amount' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return ['claimed_minutes.min' => 'Values cannot be negative', 'fixed_amount.min' => 'Values cannot be negative'];
    }
}
