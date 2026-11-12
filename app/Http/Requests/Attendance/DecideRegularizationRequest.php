<?php

namespace App\Http\Requests\Attendance;

use App\Domain\Attendance\Actions\DecideRegularization;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideRegularizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'id' => ['required', 'uuid', 'exists:regularization_requests,id'],
            'decision' => ['required', Rule::in(['approved', 'rejected'])],
            'note' => [Rule::requiredIf(fn () => $this->input('decision') === 'rejected'), 'nullable', 'string', 'max:300'],
            'resolution' => ['nullable', Rule::in(DecideRegularization::RESOLUTIONS)],
            'leave_type_id' => [Rule::requiredIf(fn () => $this->input('decision') === 'approved' && $this->input('resolution') === 'paid_leave'), 'nullable', 'uuid', 'exists:leave_types,id'],
        ];
    }

    public function messages(): array
    {
        return ['note.required' => 'Add a short reason.', 'leave_type_id.required' => 'Pick a paid leave type.'];
    }
}
