<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollAdjustmentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'item_id' => $this->item_id,
            'kind' => $this->kind,
            'label' => $this->label,
            'amount' => (int) $this->amount,
            'note' => $this->note,
            'created_by' => $this->created_by,
            'category' => $this->category ?? ($this->kind === 'bonus' ? 'bonus' : 'manual_deduction'),
            'source' => $this->source,
            'removed' => $this->deleted_at !== null,
            'deleted_by' => $this->deleted_by,
        ];
    }
}
