<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'paid_on' => 'required|date_format:Y-m-d',
            'amount' => 'required|numeric',
            'method' => 'nullable|string|max:100',
            'reference' => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return ['paid_on.required' => 'Payment date is required', 'amount.required' => 'Amount must be above zero'];
    }
}
