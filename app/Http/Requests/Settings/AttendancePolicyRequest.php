<?php

namespace App\Http\Requests\Settings;

use App\Models\AttendancePolicy;
use Illuminate\Foundation\Http\FormRequest;

class AttendancePolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manage_policy');
    }

    public function rules(): array
    {
        $self = $this->route('policy')?->id;

        return [
            'shift_start' => ['required', 'date_format:H:i'],
            'shift_end' => ['required', 'date_format:H:i', 'after:shift_start'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:120'],
            'standard_minutes' => ['required', 'integer', 'min:60', 'max:960'],
            'idle_timeout_minutes' => ['required', 'integer', 'min:1', 'max:120'],
            'lunch_cap_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'weekend_days' => ['present', 'array', 'max:6'],
            'weekend_days.*' => ['integer', 'between:0,6', 'distinct'],
            'half_day_after_minutes' => ['required', 'integer', 'min:15', 'max:480'],
            'early_leave_grace_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'early_counts_as_late' => ['required', 'boolean'],
            'half_day_min_minutes' => ['required', 'integer', 'min:30', 'max:720'],
            'absent_below_minutes' => ['required', 'integer', 'min:0', 'max:480', 'lte:half_day_min_minutes'],
            'effective_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:today',
                fn ($a, $v, $fail) => AttendancePolicy::whereDate('effective_from', $v)->when($self, fn ($q) => $q->where('id', '!=', $self))->exists() ? $fail('There is already a version starting on that date.') : null],
        ];
    }

    public function messages(): array
    {
        return [
            'effective_from.after_or_equal' => 'A new version can only start today or later. Past versions are never rewritten.',
            'effective_from.unique' => 'There is already a version starting on that date.',
            'shift_end.after' => 'The shift must end after it starts.',
            'absent_below_minutes.lte' => 'Absent threshold cannot be higher than the half-day threshold.',
        ];
    }
}
