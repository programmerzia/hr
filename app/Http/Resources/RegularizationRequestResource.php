<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegularizationRequestResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attendance_day_id' => $this->attendance_day_id,
            'employee_id' => $this->employee_id,
            'reason' => $this->reason,
            'kind' => $this->kind ?? 'late',
            'resolution' => $this->resolution,
            'leave_type_id' => $this->leave_type_id,
            'status' => $this->status,
            'decided_by' => $this->decided_by,
            'decided_at' => Fmt::dt($this->decided_at),
            'note' => $this->note,
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
