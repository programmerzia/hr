<?php

namespace App\Http\Requests\Access;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_access');
    }

    public function rules(): array
    {
        return ['role' => ['required', 'string', Rule::exists('roles', 'name')->where('guard_name', 'web')]];
    }
}
