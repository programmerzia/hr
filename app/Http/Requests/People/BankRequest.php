<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;

class BankRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return BankRules::rules();
    }

    public function messages(): array
    {
        return ['required' => 'Required'];
    }
}
