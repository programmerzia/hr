<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;

class ClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $req = $this->isMethod('POST') ? 'required' : 'sometimes|required';

        return [
            'name' => "{$req}|string|max:255",
            'email' => "{$req}|string|max:255",
            'address' => 'nullable|string|max:1000',
            'currency' => "{$req}|in:BDT,USD,EUR",
            'default_rate' => 'nullable|numeric|min:0',
        ];
    }

    public function messages(): array
    {
        return ['name.required' => 'Name is required', 'email.required' => 'Email is required'];
    }
}
