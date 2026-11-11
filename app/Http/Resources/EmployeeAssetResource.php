<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeAssetResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'name' => $this->name,
            'tag' => $this->tag,
            'assigned_on' => Fmt::d($this->assigned_on),
            'returned_on' => Fmt::d($this->returned_on),
            'status' => $this->status,
        ];
    }
}
