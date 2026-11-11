<?php

namespace App\Http\Requests\Work;

use Illuminate\Foundation\Http\FormRequest;

/** Member add, column add/rename/reorder: lead, HR and management only. */
class ProjectManageRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = $this->route('project') ?? $this->route('column')?->project;

        return $this->user()->can('manage', $project);
    }

    public function rules(): array
    {
        return match ($this->route()->getName()) {
            'work.projects.members.add' => ['employee_id' => ['required', 'exists:employees,id']],
            'work.projects.columns.reorder' => ['ids' => ['required', 'array'], 'ids.*' => ['string']],
            default => ['name' => ['required', 'string', 'max:60']],
        };
    }

    public function messages(): array
    {
        return ['name.required' => 'Enter a column name.'];
    }
}
