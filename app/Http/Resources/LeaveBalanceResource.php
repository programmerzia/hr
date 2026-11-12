<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveBalanceResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,
            'year' => (int) $this->year,
            'entitled' => (float) $this->entitled,
            'used' => (float) $this->used,
            'pending' => (float) $this->pending,
            'carried_in' => (float) $this->carried_in,
            'encashed' => (float) $this->encashed,
        ];
    }
}
