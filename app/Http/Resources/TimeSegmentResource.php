<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TimeSegmentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attendance_day_id' => $this->attendance_day_id,
            'type' => $this->type,
            'break_category' => $this->break_category,
            'started_at' => Fmt::dt($this->started_at),
            'ended_at' => Fmt::dt($this->ended_at),
            'note' => $this->note,
            'source' => $this->source,
        ];
    }
}
