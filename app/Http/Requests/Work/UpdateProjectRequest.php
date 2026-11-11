<?php

namespace App\Http\Requests\Work;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage', $this->route('project'));
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'status' => ['sometimes', Rule::in(['active', 'paused', 'done'])],
            'lead_employee_id' => ['sometimes', 'exists:employees,id'],
            'client_id' => ['sometimes', 'nullable', 'exists:clients,id'],
        ];
    }
}
