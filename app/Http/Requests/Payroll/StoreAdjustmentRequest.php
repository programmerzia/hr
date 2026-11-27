<?php

namespace App\Http\Requests\Payroll;

use App\Models\PayrollAdjustment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category' => ['required', Rule::in(array_keys(PayrollAdjustment::CATEGORIES))],
            'label' => ['nullable', 'string', 'max:160'],
            'amount' => ['nullable', 'numeric'],
            'note' => ['required', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return ['category.*' => 'Choose what kind of adjustment this is.', 'note.required' => 'Give a reason for this adjustment.'];
    }
}
