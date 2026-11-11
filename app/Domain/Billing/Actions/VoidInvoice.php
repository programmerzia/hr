<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

class VoidInvoice
{
    public function __invoke(Invoice $invoice, ?string $actorId): Invoice
    {
        return DB::transaction(function () use ($invoice, $actorId) {
            $i = Invoice::lockForUpdate()->findOrFail($invoice->id);
            if ($i->status === 'void') {
                Fail::with('Already void');
            }
            if ($i->status === 'paid' || $i->paid_total > 0) {
                Fail::with('Invoices with payments cannot be voided');
            }
            $i->update(['status' => 'void']);
            Audit::log('invoice', $i->id, 'voided the invoice', $actorId);

            return $i;
        });
    }
}
