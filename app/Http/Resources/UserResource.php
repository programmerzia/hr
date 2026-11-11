<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'must_change_password' => (bool) $this->must_change_password,
            'role' => $this->role,
            'employee_id' => $this->employee_id,
            'last_seen_at' => Fmt::dt($this->last_seen_at),
        ];
    }
}
