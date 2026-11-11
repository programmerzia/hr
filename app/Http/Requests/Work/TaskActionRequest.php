<?php

namespace App\Http\Requests\Work;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Move, subtask add, comment, attachment: project writers only. Subtask toggle resolves its task. */
class TaskActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $task = $this->route('task') ?? $this->route('subtask')->task;

        return $this->user()->can('update', $task);
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return match ($this->route()->getName()) {
            'work.tasks.move' => [
                'column_id' => ['required', Rule::exists('board_columns', 'id')->where('project_id', $task->project_id)],
                'position' => ['nullable', 'integer', 'min:0'],
            ],
            'work.tasks.subtasks.store' => ['title' => ['required', 'string', 'max:200']],
            'work.tasks.comments' => [
                'body' => ['nullable', 'string', 'required_without:files'],
                'files' => ['nullable', 'array', 'max:10'],
                'files.*' => ['file', 'max:10240'],
            ],
            'work.tasks.attachments' => ['file' => ['required', 'file', 'max:10240']],
            default => [],
        };
    }
}
