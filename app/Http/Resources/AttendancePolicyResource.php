<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendancePolicyResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'shift_start' => $this->shift_start,
            'shift_end' => $this->shift_end,
            'grace_minutes' => (int) $this->grace_minutes,
            'standard_minutes' => (int) $this->standard_minutes,
            'idle_timeout_minutes' => (int) $this->idle_timeout_minutes,
            'lunch_cap_minutes' => (int) $this->lunch_cap_minutes,
            'late_penalty_rule' => $this->late_penalty_rule,
            'weekend_days' => array_map('intval', $this->weekend_days ?? []),
        ];
    }
}
