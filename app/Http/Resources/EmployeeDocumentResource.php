<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeDocumentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'kind' => $this->kind,
            'name' => $this->name,
            'path' => $this->path,
            'uploaded_at' => Fmt::dt($this->uploaded_at),
        ];
    }
}
