<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalaryStructureResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'effective_from' => Fmt::d($this->effective_from),
            'basic' => (int) $this->basic,
            'house_rent' => (int) $this->house_rent,
            'medical' => (int) $this->medical,
            'conveyance' => (int) $this->conveyance,
            'pf_percent' => (float) $this->pf_percent,
            'tax_monthly' => (int) $this->tax_monthly,
            'gross' => (int) $this->gross,
            'hourly_rate' => (int) $this->hourly_rate,
            'pf_employer_percent' => $this->pf_employer_percent === null ? null : (float) $this->pf_employer_percent,
            'other_allowances' => $this->resource->otherAllowances(),
            'note' => $this->note,
        ];
    }
}
