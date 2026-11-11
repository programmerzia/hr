<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractorClaimResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'year' => (int) $this->year,
            'month' => (int) $this->month,
            'tracked_minutes' => (int) $this->tracked_minutes,
            'claimed_minutes' => (int) $this->claimed_minutes,
            'rate' => (int) $this->rate,
            'fixed_amount' => $this->fixed_amount === null ? null : (int) $this->fixed_amount,
            'total' => (int) $this->total,
            'status' => $this->status,
            'verified_by' => $this->verified_by,
            'approved_by' => $this->approved_by,
            'paid_at' => Fmt::dt($this->paid_at),
            'bank_account_id' => $this->bank_account_id,
            'pdf_path' => $this->pdf_path,
        ];
    }
}
