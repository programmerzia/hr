<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;

class MarkPaidRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['paid_on' => ['required', 'date_format:Y-m-d'], 'reference' => ['required', 'string', 'max:120']];
    }

    public function messages(): array
    {
        return ['paid_on.required' => 'Choose the disbursement date.', 'paid_on.date_format' => 'Choose the disbursement date.', 'reference.required' => 'Enter the bank reference.'];
    }
}
