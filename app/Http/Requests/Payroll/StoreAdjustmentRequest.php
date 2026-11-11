<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

class StoreAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kind' => ['required', 'in:bonus,deduction'],
            'label' => ['nullable', 'string', 'max:160'],
            'amount' => ['nullable', 'numeric'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
