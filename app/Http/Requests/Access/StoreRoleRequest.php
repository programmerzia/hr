<?php

namespace App\Http\Requests\Access;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_access');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:40', 'regex:/^[a-z][a-z0-9_]*$/', Rule::unique('roles', 'name')->where('guard_name', 'web')],
            'label' => ['required', 'string', 'max:60'],
        ];
    }

    public function messages(): array
    {
        return ['name.regex' => 'Use lowercase letters, digits and underscores, starting with a letter.', 'name.unique' => 'A role with that name already exists.'];
    }
}
