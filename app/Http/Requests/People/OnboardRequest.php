<?php

namespace App\Http\Requests\People;

use App\Domain\People\Actions\Concerns;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class OnboardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'email' => ['required', 'email:filter', 'unique:employees,email', 'unique:users,email'],
            'phone' => ['required', 'string'],
            'nid' => ['required', 'regex:/^\d{10,17}$/'],
            'department_id' => ['required', 'exists:departments,id'],
            'team_id' => ['nullable', 'exists:teams,id'],
            'designation' => ['required', 'string'],
            'employment_type' => ['required', Rule::in(['full_time', 'contractor', 'intern'])],
            'role' => ['required', Rule::in(['employee', 'team_lead', 'hr', 'management'])],
            'joined_on' => ['required', 'date'],
            'probation_until' => ['nullable', 'date', 'after:joined_on'],
            'salary' => ['nullable', 'array'],
            'bank' => ['nullable', 'array'],
            'bank.account_no' => ['required_with:bank', 'regex:/^\d{6,20}$/'],
            'bank.routing_no' => ['required_with:bank', 'regex:/^\d{9}$/'],
            'bank.bank' => ['required_with:bank', 'string'],
            'bank.branch' => ['required_with:bank', 'string'],
            'bank.account_name' => ['required_with:bank', 'string'],
            'checklist' => ['nullable', 'array'],
            'checklist.*' => ['string', Rule::in(Concerns::DEFAULT_CHECKLIST)],
        ];
    }

    public function messages(): array
    {
        return [
            'required' => 'Required',
            'required_with' => 'Required',
            'email.email' => 'Enter a valid email address',
            'email.unique' => 'Someone with this email already exists',
            'nid.regex' => 'Enter 10 to 17 digits',
            'probation_until.after' => 'Must be after the joining date',
            'bank.account_no.regex' => 'Enter 6 to 20 digits',
            'bank.routing_no.regex' => 'Enter a 9 digit routing number',
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($this->input('salary') !== null) {
                SalaryRules::check($v, $this->input('salary'), $this->input('employment_type') === 'contractor', 'salary.', needDate: false);
            }
        }];
    }

    /** Validated payload with the salary cast to numbers. */
    public function payload(): array
    {
        $data = $this->validated();
        if (! empty($data['salary'])) {
            $s = $data['salary'];
            $s['effective_from'] = $s['effective_from'] ?? $data['joined_on'];
            $data['salary'] = SalaryRules::normalise($s, $data['employment_type'] === 'contractor');
        }

        return $data;
    }
}
