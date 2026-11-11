<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\InvoiceTotals;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Create or edit a draft. Drafts carry a DRAFT-xxxxxxxx placeholder; the VIV number is assigned on send. */
class SaveInvoice
{
    /** @param array{client_id: string, project_id: ?string, issued_on: string, due_on: string, currency: string, lines: list<array>, tax_percent: float|int, discount: int, notes: ?string} $d */
    public function __invoke(array $d, ?Invoice $invoice, ?string $actorId): Invoice
    {
        return DB::transaction(function () use ($d, $invoice, $actorId) {
            if ($invoice) {
                $invoice = Invoice::lockForUpdate()->findOrFail($invoice->id);
                if ($invoice->status !== 'draft') {
                    Fail::with('Only draft invoices can be edited');
                }
            }
            $lines = collect($d['lines'])->map(fn ($l) => [
                'description' => trim($l['description']),
                'qty' => (float) $l['qty'],
                'unit_price' => (int) round((float) $l['unit_price']),
            ])->all();
            $t = InvoiceTotals::compute($lines, (float) $d['tax_percent'], (int) round((float) $d['discount']));
            $fields = [
                'client_id' => $d['client_id'], 'project_id' => $d['project_id'] ?: null,
                'issued_on' => $d['issued_on'], 'due_on' => $d['due_on'], 'currency' => $d['currency'],
                'subtotal' => $t['subtotal'], 'tax_percent' => (float) $d['tax_percent'],
                'discount' => (int) round((float) $d['discount']), 'total' => $t['total'],
                'notes' => trim((string) ($d['notes'] ?? '')) ?: null,
            ];
            if ($invoice) {
                $invoice->update($fields);
                InvoiceLine::where('invoice_id', $invoice->id)->delete();
            } else {
                $invoice = Invoice::create($fields + ['number' => 'DRAFT-'.Str::upper(Str::random(8)), 'status' => 'draft', 'paid_total' => 0]);
            }
            foreach ($lines as $l) {
                InvoiceLine::create($l + ['invoice_id' => $invoice->id, 'amount' => InvoiceTotals::amount($l['qty'], $l['unit_price'])]);
            }
            Audit::log('invoice', $invoice->id, $invoice->wasRecentlyCreated ? 'created the invoice as a draft' : 'edited the draft', $actorId);

            return $invoice;
        });
    }
}
