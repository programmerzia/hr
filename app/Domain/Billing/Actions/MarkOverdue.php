<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Support\Audit;
use App\Models\Invoice;

class MarkOverdue
{
    /** Sent invoices past their due date become overdue. Returns how many changed. */
    public function __invoke(): int
    {
        $late = Invoice::where('status', 'sent')->whereDate('due_on', '<', now()->format('Y-m-d'))->get();
        foreach ($late as $i) {
            $i->update(['status' => 'overdue']);
            Audit::log('invoice', $i->id, 'was marked overdue', null);
        }

        return $late->count();
    }
}
