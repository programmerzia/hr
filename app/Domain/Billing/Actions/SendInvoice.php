<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\Invoice;
use Illuminate\Database\UniqueConstraintViolationException;
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
            $next = $this->nextNumber((int) $year);
            $i->update([
                'number' => sprintf('VIV-%s-%04d', $year, $next),
                'status' => $i->due_on->format('Y-m-d') < now()->format('Y-m-d') ? 'overdue' : 'sent',
            ]);
            Audit::log('invoice', $i->id, 'sent the invoice to the client', $actorId, ['number' => $i->number]);

            return $i;
        });
    }

    /** Next sequence for the year under a row lock; the first use continues from the highest existing number. */
    private function nextNumber(int $year): int
    {
        $row = DB::table('invoice_counters')->where('year', $year)->lockForUpdate()->first();
        if (! $row) {
            $max = Invoice::where('number', 'like', "VIV-{$year}-%")->pluck('number')
                ->map(fn ($n) => (int) substr($n, -4))->max() ?? 0;
            try {
                DB::table('invoice_counters')->insert(['year' => $year, 'last' => $max]);
            } catch (UniqueConstraintViolationException) {
                // another sender created it; lock it below
            }
            $row = DB::table('invoice_counters')->where('year', $year)->lockForUpdate()->first();
        }
        $next = $row->last + 1;
        DB::table('invoice_counters')->where('year', $year)->update(['last' => $next]);

        return $next;
    }
}
