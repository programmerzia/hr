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
            'half_day_after_minutes' => (int) $this->half_day_after_minutes,
            'early_leave_grace_minutes' => (int) $this->early_leave_grace_minutes,
            'early_counts_as_late' => (bool) $this->early_counts_as_late,
            'half_day_min_minutes' => (int) $this->half_day_min_minutes,
            'absent_below_minutes' => (int) $this->absent_below_minutes,
            'weekend_days' => array_map('intval', $this->weekend_days ?? []),
        ];
    }
}
