<?php

namespace App\Http\Requests\Settings;

use App\Models\PayrollPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PayrollPolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_policy');
    }

    public function rules(): array
    {
        $self = $this->route('policy')?->id;

        return [
            'daily_rate_basis' => ['required', Rule::in(['working_days', 'calendar_days', 'fixed_30', 'fixed_26'])],
            'lop_enabled' => ['required', 'boolean'],
            'late_penalty_enabled' => ['required', 'boolean'],
            'lates_per_penalty' => ['required', 'integer', 'min:1', 'max:31'],
            'penalty_days' => ['required', 'numeric', 'min:0.25', 'max:5'],
            'max_penalty_days_per_month' => ['required', 'numeric', 'min:0', 'max:31'],
            'pf_enabled' => ['required', 'boolean'],
            'pf_employee_percent' => ['required', 'numeric', 'min:0', 'max:30'],
            'pf_employer_percent' => ['required', 'numeric', 'min:0', 'max:30'],
            'tax_enabled' => ['required', 'boolean'],
            'overtime_enabled' => ['required', 'boolean'],
            'overtime_multiplier' => ['required', 'numeric', 'min:1', 'max:5'],
            'overtime_requires_approval' => ['required', 'boolean'],
            'overtime_min_block_minutes' => ['required', 'integer', 'min:1', 'max:240'],
            'overtime_daily_cap_minutes' => ['required', 'integer', 'min:0', 'max:720'],
            'effective_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today',
                fn ($a, $v, $fail) => PayrollPolicy::whereDate('effective_from', $v)->when($self, fn ($q) => $q->where('id', '!=', $self))->exists() ? $fail('There is already a version starting on that date.') : null],
        ];
    }

    public function messages(): array
    {
        return [
            'effective_from.after_or_equal' => 'A new version can only start today or later. Past versions are never rewritten.',
            'effective_from.unique' => 'There is already a version starting on that date.',
        ];
    }
}
