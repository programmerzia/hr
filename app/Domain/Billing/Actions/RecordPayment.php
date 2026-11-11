<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use Illuminate\Support\Facades\DB;

class RecordPayment
{
    /** @param array{paid_on: ?string, amount: float|int, method?: ?string, reference?: ?string} $p */
    public function __invoke(Invoice $invoice, array $p, ?string $actorId): InvoicePayment
    {
        return DB::transaction(function () use ($invoice, $p, $actorId) {
            $i = Invoice::lockForUpdate()->findOrFail($invoice->id);
            match ($i->status) {
                'draft' => Fail::with('Send the invoice before recording a payment'),
                'void' => Fail::with('This invoice is void'),
                'paid' => Fail::with('This invoice is already paid'),
                default => null,
            };
            $amount = (int) round((float) $p['amount']);
            if ($amount <= 0) {
                Fail::with('Amount must be above zero');
            }
            if ($amount > $i->total - $i->paid_total) {
                Fail::with('Amount is more than the balance due');
            }
            if (empty($p['paid_on'])) {
                Fail::with('Payment date is required');
            }
            $method = trim((string) ($p['method'] ?? '')) ?: 'Bank transfer';
            $payment = InvoicePayment::create([
                'invoice_id' => $i->id, 'paid_on' => $p['paid_on'], 'amount' => $amount, 'method' => $method,
                'reference' => trim((string) ($p['reference'] ?? '')) ?: null,
            ]);
            $paid = $i->paid_total + $amount;
            $i->update(['paid_total' => $paid, 'status' => $paid >= $i->total ? 'paid' : $i->status]);
            Audit::log('invoice', $i->id, 'recorded a payment of '.number_format($amount)." {$i->currency} ({$method})", $actorId);

            return $payment;
        });
    }
}
