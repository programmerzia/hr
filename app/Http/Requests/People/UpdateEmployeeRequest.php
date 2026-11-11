<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        $employee = $this->route('employee');

        return [
            'name' => ['required', 'string'],
            'designation' => ['required', 'string'],
            'email' => ['required', 'email:filter', Rule::unique('employees', 'email')->ignore($employee->id), Rule::unique('users', 'email')->ignore($employee->user_id)],
            'phone' => ['nullable', 'string'],
            'team_id' => ['nullable', 'exists:teams,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'required' => 'Required',
            'email.email' => 'Enter a valid email address',
            'email.unique' => 'Someone with this email already exists',
        ];
    }
}
