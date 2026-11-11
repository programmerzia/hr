<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoicePaymentResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_id' => $this->invoice_id,
            'paid_on' => Fmt::d($this->paid_on),
            'amount' => (int) $this->amount,
            'method' => $this->method,
            'reference' => $this->reference,
        ];
    }
}
