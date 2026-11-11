<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskTimeEntryResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'time_segment_id' => $this->time_segment_id,
            'task_id' => $this->task_id,
            'employee_id' => $this->employee_id,
            'started_at' => Fmt::dt($this->started_at),
            'ended_at' => Fmt::dt($this->ended_at),
            'seconds' => (int) $this->seconds,
        ];
    }
}
