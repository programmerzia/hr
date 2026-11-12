<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class BulkHolidaysRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_policy');
    }

    public function rules(): array
    {
        return ['lines' => ['required', 'string', 'max:20000']];
    }
}
