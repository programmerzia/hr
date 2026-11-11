<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveApprovalResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'leave_request_id' => $this->leave_request_id,
            'stage' => $this->stage,
            'decided_by' => $this->decided_by,
            'decision' => $this->decision,
            'note' => $this->note,
            'decided_at' => Fmt::dt($this->decided_at),
        ];
    }
}
