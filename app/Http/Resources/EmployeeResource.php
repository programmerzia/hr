<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'email' => $this->email,
            'department_id' => $this->department_id,
            'team_id' => $this->team_id,
            'designation' => $this->designation,
            'employment_type' => $this->employment_type,
            'status' => $this->status,
            'joined_on' => Fmt::d($this->joined_on),
            'probation_until' => Fmt::d($this->probation_until),
            'exited_on' => Fmt::d($this->exited_on),
            'phone' => $this->phone,
            'nid' => $this->nid,
            'avatar_path' => $this->avatar_path,
        ];
    }
}
