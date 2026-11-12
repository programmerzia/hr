<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceDayResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'date' => Fmt::d($this->date),
            'status' => $this->status,
            'first_in_at' => Fmt::dt($this->first_in_at),
            'last_out_at' => Fmt::dt($this->last_out_at),
            'work_seconds' => (int) $this->work_seconds,
            'break_seconds' => (int) $this->break_seconds,
            'late_minutes' => (int) $this->late_minutes,
            'is_regularized' => (bool) $this->is_regularized,
            'day_fraction' => (float) ($this->day_fraction ?? 1),
            'absence_kind' => $this->absence_kind ?? 'none',
            'early_minutes' => (int) $this->early_minutes,
            'auto_closed' => (bool) $this->auto_closed,
        ];
    }
}
