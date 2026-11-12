<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollRunResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'year' => (int) $this->year,
            'month' => (int) $this->month,
            'status' => $this->status,
            'approved_by' => $this->approved_by,
            'approved_at' => Fmt::dt($this->approved_at),
            'paid_at' => Fmt::dt($this->paid_at),
            'payment_reference' => $this->payment_reference,
            'locked_at' => Fmt::dt($this->locked_at),
            'kind' => $this->kind ?? 'regular',
            'label' => $this->label,
            'bonus_percent_of_basic' => $this->bonus_percent_of_basic === null ? null : (float) $this->bonus_percent_of_basic,
            'employee_id' => $this->employee_id,
            'reopened_at' => Fmt::dt($this->reopened_at),
            'reopened_by' => $this->reopened_by,
            'reopen_reason' => $this->reopen_reason,
        ];
    }
}
