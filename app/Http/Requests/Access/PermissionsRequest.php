<?php

namespace App\Http\Requests\Access;

use App\Support\Access;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_access');
    }

    public function rules(): array
    {
        return [
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'distinct', Rule::in(Access::names())],
            'label' => ['sometimes', 'string', 'max:60'],
        ];
    }
}
