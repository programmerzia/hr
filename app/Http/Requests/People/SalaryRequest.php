<?php

namespace App\Http\Requests\People;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SalaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage_people') ?? false;
    }

    public function rules(): array
    {
        return [];
    }

    public function after(): array
    {
        return [fn (Validator $v) => SalaryRules::check($v, $this->all(), $this->hourly())];
    }

    private function hourly(): bool
    {
        return $this->route('employee')->employment_type === 'contractor';
    }

    public function payload(): array
    {
        return SalaryRules::normalise($this->all(), $this->hourly());
    }
}
