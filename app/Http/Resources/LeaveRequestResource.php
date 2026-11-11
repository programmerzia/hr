<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveRequestResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'leave_type_id' => $this->leave_type_id,
            'starts_on' => Fmt::d($this->starts_on),
            'ends_on' => Fmt::d($this->ends_on),
            'half_day' => $this->half_day,
            'days' => (float) $this->days,
            'reason' => $this->reason,
            'attachment_path' => $this->attachment_path,
            'status' => $this->status,
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
