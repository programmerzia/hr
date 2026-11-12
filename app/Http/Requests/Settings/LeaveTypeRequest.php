<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeaveTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_policy');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60', Rule::unique('leave_types', 'name')->ignore($this->route('leaveType')?->id)],
            'annual_quota' => ['required', 'numeric', 'min:0', 'max:365'],
            'is_paid' => ['required', 'boolean'],
            'carry_forward' => ['required', 'boolean'],
            'allows_half_day' => ['required', 'boolean'],
            'carry_forward_cap' => ['nullable', 'numeric', 'min:0', 'max:365'],
            'allowed_on_probation' => ['required', 'boolean'],
            'encashable' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['name.unique' => 'A leave type with this name already exists.'];
    }
}
