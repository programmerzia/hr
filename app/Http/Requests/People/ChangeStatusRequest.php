<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['active', 'probation', 'on_leave', 'resigned', 'terminated'])],
            'effective_on' => ['required', 'date'],
        ];
    }

    public function messages(): array
    {
        return ['effective_on.required' => 'Choose the effective date', 'effective_on.date' => 'Choose the effective date'];
    }
}
