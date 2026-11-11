<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;

class AssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'tag' => ['required', 'string'],
            'assigned_on' => ['required', 'date'],
        ];
    }

    public function messages(): array
    {
        return ['required' => 'Required'];
    }
}
