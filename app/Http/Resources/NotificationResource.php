<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Laravel DatabaseNotification -> TS Notification. `data` holds {kind, title, body, link}. */
class NotificationResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $data = $this->data ?? [];

        return [
            'id' => $this->id,
            'employee_id' => $this->notifiable?->employee_id,
            'kind' => $data['kind'] ?? 'mention',
            'title' => $data['title'] ?? '',
            'body' => $data['body'] ?? null,
            'link' => $data['link'] ?? '/inbox',
            'read_at' => Fmt::dt($this->read_at),
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
