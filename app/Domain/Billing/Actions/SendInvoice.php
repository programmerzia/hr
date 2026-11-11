<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

class SendInvoice
{
    /** Assigns the next VIV-YYYY-NNNN number of the issue year and marks the invoice sent (overdue when already past due). */
    public function __invoke(Invoice $invoice, ?string $actorId): Invoice
    {
        return DB::transaction(function () use ($invoice, $actorId) {
            $i = Invoice::lockForUpdate()->findOrFail($invoice->id);
            if ($i->status !== 'draft') {
                Fail::with('Only draft invoices can be sent');
            }
            $year = $i->issued_on->format('Y');
            $max = Invoice::where('number', 'like', "VIV-{$year}-%")->pluck('number')
                ->map(fn ($n) => (int) substr($n, -4))->max() ?? 0;
            $i->update([
                'number' => sprintf('VIV-%s-%04d', $year, $max + 1),
                'status' => $i->due_on->format('Y-m-d') < now()->format('Y-m-d') ? 'overdue' : 'sent',
            ]);
            Audit::log('invoice', $i->id, 'sent the invoice to the client', $actorId, ['number' => $i->number]);

            return $i;
        });
    }
}
