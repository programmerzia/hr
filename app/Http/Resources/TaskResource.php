<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'number' => (int) $this->number,
            'title' => $this->title,
            'key' => $this->key,
            'body_md' => $this->body_md,
            'column_id' => $this->column_id,
            'priority' => $this->priority,
            'assignee_id' => $this->assignee_id,
            'reporter_id' => $this->reporter_id,
            'estimate_minutes' => $this->estimate_minutes === null ? null : (int) $this->estimate_minutes,
            'due_on' => Fmt::d($this->due_on),
            'position' => (int) $this->position,
            'created_at' => Fmt::dt($this->created_at),
        ];
    }
}
