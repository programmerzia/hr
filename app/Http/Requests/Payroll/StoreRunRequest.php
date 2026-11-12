<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $settlement = $this->input('kind') === 'settlement';
        $festival = $this->input('kind') === 'festival';

        return [
            'kind' => ['nullable', Rule::in(['regular', 'festival', 'settlement'])],
            // A settlement run takes its month from the employee's exit date.
            'year' => [$settlement ? 'nullable' : 'required', 'integer', 'between:2000,2100'],
            'month' => [$settlement ? 'nullable' : 'required', 'integer', 'between:1,12'],
            'bonus_percent_of_basic' => [$festival ? 'required' : 'nullable', 'numeric', 'between:1,200'],
            'label' => [$festival ? 'required' : 'nullable', 'string', 'max:120'],
            'employee_id' => [$settlement ? 'required' : 'nullable', 'string', Rule::exists('employees', 'id')],
        ];
    }

    public function messages(): array
    {
        return [
            'bonus_percent_of_basic.*' => 'Enter a bonus from 1 to 200 percent of basic.',
            'label.required' => 'Name the bonus, for example "Eid-ul-Fitr bonus".',
            'employee_id.*' => 'Pick the employee for the final settlement.',
        ];
    }
}
