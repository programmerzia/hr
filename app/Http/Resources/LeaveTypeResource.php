<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveTypeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'annual_quota' => (float) $this->annual_quota,
            'is_paid' => (bool) $this->is_paid,
            'carry_forward' => (bool) $this->carry_forward,
            'allows_half_day' => (bool) $this->allows_half_day,
            'carry_forward_cap' => $this->carry_forward_cap === null ? null : (float) $this->carry_forward_cap,
            'allowed_on_probation' => (bool) $this->allowed_on_probation,
            'encashable' => (bool) $this->encashable,
        ];
    }
}
