<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttachmentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attachable_type' => $this->attachable_type,
            'attachable_id' => $this->attachable_id,
            'name' => $this->name,
            'mime' => $this->mime,
            'size' => (int) $this->size,
            'path' => $this->path,
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
