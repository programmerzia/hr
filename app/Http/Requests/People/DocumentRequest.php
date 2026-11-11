<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::in(['nid', 'contract', 'cv', 'certificate', 'other'])],
            'file' => ['required', 'file', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return ['file.required' => 'Choose a file', 'file.file' => 'Choose a file', 'file.max' => 'File must be 10 MB or smaller'];
    }
}
