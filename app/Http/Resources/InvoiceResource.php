<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'client_id' => $this->client_id,
            'project_id' => $this->project_id,
            'issued_on' => Fmt::d($this->issued_on),
            'due_on' => Fmt::d($this->due_on),
            'currency' => $this->currency,
            'subtotal' => (int) $this->subtotal,
            'tax_percent' => (float) $this->tax_percent,
            'discount' => (int) $this->discount,
            'total' => (int) $this->total,
            'paid_total' => (int) $this->paid_total,
            'status' => $this->status,
            'notes' => $this->notes,
            'pdf_path' => $this->pdf_path,
        ];
    }
}
