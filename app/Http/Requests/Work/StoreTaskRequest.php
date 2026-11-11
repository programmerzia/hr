<?php

namespace App\Http\Requests\Work;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        $project = Project::find($this->input('project_id'));

        return $project && $this->user()->can('write', $project);
    }

    public function rules(): array
    {
        return [
            'project_id' => ['required', 'exists:projects,id'],
            'title' => ['required', 'string', 'max:200'],
            'body_md' => ['nullable', 'string'],
            'column_id' => ['nullable', Rule::exists('board_columns', 'id')->where('project_id', $this->input('project_id'))],
            'priority' => ['nullable', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assignee_id' => ['nullable', 'exists:employees,id'],
            'estimate_minutes' => ['nullable', 'integer', 'min:0'],
            'due_on' => ['nullable', 'date_format:Y-m-d'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['exists:labels,id'],
        ];
    }

    public function messages(): array
    {
        return ['title.required' => 'Enter a title.'];
    }
}
