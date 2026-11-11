<?php

namespace App\Http\Requests\Work;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Project::class);
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['key' => strtoupper(trim((string) $this->input('key')))]);
        // Team leads can only lead their own projects.
        if ($this->user()->role === 'team_lead') {
            $this->merge(['lead_employee_id' => $this->user()->employee_id]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'key' => ['required', 'regex:/^[A-Z]{2,6}$/', 'unique:projects,key'],
            'billing_type' => ['required', Rule::in(['internal', 'retainer', 'hourly', 'fixed'])],
            'client_id' => ['nullable', 'required_unless:billing_type,internal', 'exists:clients,id'],
            'lead_employee_id' => ['required', 'exists:employees,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Enter a project name.',
            'key.regex' => 'Key must be 2 to 6 letters.',
            'key.required' => 'Key must be 2 to 6 letters.',
            'key.unique' => 'That key is already used.',
            'client_id.required_unless' => 'Choose a client for billable projects.',
        ];
    }
}
