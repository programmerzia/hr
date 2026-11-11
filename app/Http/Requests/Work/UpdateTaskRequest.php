<?php

namespace App\Http\Requests\Work;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('task'));
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:200'],
            'body_md' => ['sometimes', 'nullable', 'string'],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assignee_id' => ['sometimes', 'nullable', 'exists:employees,id'],
            'estimate_minutes' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['exists:labels,id'],
        ];
    }
}
