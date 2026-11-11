<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'author_id' => $this->author_id,
            'body' => $this->body,
            'attachments' => $this->attachments ?? [],
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
