<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Actions\RequestRegularization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRegularizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'attendance_day_id' => ['required', 'uuid', 'exists:attendance_days,id'],
            'reason' => ['required', 'string', 'max:300'],
            'kind' => ['nullable', Rule::in(RequestRegularization::KINDS)],
        ];
    }

    public function messages(): array
    {
        return ['reason.required' => 'Add a short reason.'];
    }
}
