<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationMemberResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'conversation_id' => $this->conversation_id,
            'employee_id' => $this->employee_id,
            'last_read_message_id' => $this->last_read_message_id,
        ];
    }
}
