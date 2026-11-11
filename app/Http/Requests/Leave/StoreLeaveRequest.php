<?php

namespace App\Http\Requests\Leave;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Shape only; the business rules and their messages live in SubmitLeave. */
class StoreLeaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'leave_type_id' => ['nullable', 'string'],
            'starts_on' => ['nullable', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
            'half_day' => ['nullable', Rule::in(['none', 'first_half', 'second_half'])],
            'reason' => ['nullable', 'string', 'max:2000'],
            'attachment_name' => ['nullable', 'string', 'max:200'],
        ];
    }
}
