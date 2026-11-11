<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogEntryResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            'actor_id' => $this->actor_id,
            'description' => $this->description,
            'properties' => $this->properties,
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
