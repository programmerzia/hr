<?php

namespace App\Http\Requests\Billing;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class InvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => 'required|exists:clients,id',
            'project_id' => 'nullable|exists:projects,id',
            'issued_on' => 'required|date_format:Y-m-d',
            'due_on' => 'required|date_format:Y-m-d',
            'currency' => 'required|in:BDT,USD,EUR',
            'lines' => 'required|array|min:1',
            'lines.*.description' => 'required|string|max:255',
            'lines.*.qty' => 'required|numeric|gt:0',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'tax_percent' => 'required|numeric|min:0',
            'discount' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
        ];
    }

    public function messages(): array
    {
        return [
            'client_id.required' => 'Choose a client',
            'client_id.exists' => 'Choose a client',
            'issued_on.required' => 'Issue and due dates are required',
            'due_on.required' => 'Issue and due dates are required',
            'lines.required' => 'Add at least one line',
            'lines.min' => 'Add at least one line',
            'lines.*.description.required' => 'Every line needs a description',
            'lines.*.qty.required' => 'Quantity must be above zero and price cannot be negative',
            'lines.*.qty.gt' => 'Quantity must be above zero and price cannot be negative',
            'lines.*.unit_price.required' => 'Quantity must be above zero and price cannot be negative',
            'lines.*.unit_price.min' => 'Quantity must be above zero and price cannot be negative',
            'tax_percent.min' => 'Tax and discount cannot be negative',
            'discount.min' => 'Tax and discount cannot be negative',
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isEmpty() && $this->input('due_on') < $this->input('issued_on')) {
                $v->errors()->add('due_on', 'Due date cannot be before the issue date');
            }
        }];
    }
}
