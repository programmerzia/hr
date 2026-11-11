<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class GenerateClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'year' => 'required|integer|between:2000,2100',
            'month' => 'required|integer|between:1,12',
            'employee_id' => 'nullable|exists:employees,id',
        ];
    }
}
