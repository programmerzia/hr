<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideRegularizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid', 'exists:regularization_requests,id'],
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => [Rule::requiredIf(fn () => $this->input('decision') === 'rejected'), 'nullable', 'string', 'max:300'],
        ];
    }

    public function messages(): array
    {
        return ['note.required' => 'Add a short reason.'];
    }
}
