<?php

namespace App\Http\Requests\Settings;

use App\Models\Holiday;
use Illuminate\Foundation\Http\FormRequest;

class HolidayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_policy');
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d', fn ($a, $v, $fail) => Holiday::whereDate('date', $v)->exists() ? $fail('That date is already a holiday.') : null],
            'name' => ['required', 'string', 'max:80'],
        ];
    }

    public function messages(): array
    {
        return ['date.unique' => 'That date is already a holiday.'];
    }
}
