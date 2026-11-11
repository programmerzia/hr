<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BankAccountResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'bank' => $this->bank,
            'account_name' => $this->account_name,
            'account_no' => $this->account_no,
            'routing_no' => $this->routing_no,
            'branch' => $this->branch,
            'is_primary' => (bool) $this->is_primary,
        ];
    }
}
