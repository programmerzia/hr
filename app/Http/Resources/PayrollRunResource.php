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
        ];
    }
}
