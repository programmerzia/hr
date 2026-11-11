<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'name' => $this->name,
            'client_id' => $this->client_id,
            'lead_employee_id' => $this->lead_employee_id,
            'status' => $this->status,
            'billing_type' => $this->billing_type,
            'rate' => $this->rate === null ? null : (int) $this->rate,
        ];
    }
}
