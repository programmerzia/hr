<?php

namespace App\Console\Commands;

use App\Domain\Billing\Actions\MarkOverdue;
use Illuminate\Console\Command;

class BillingSweepOverdue extends Command
{
    protected $signature = 'billing:sweep-overdue';

    protected $description = 'Mark sent invoices past their due date as overdue';

    public function handle(MarkOverdue $sweep): int
    {
        $this->info('Invoices marked overdue: '.$sweep());

        return self::SUCCESS;
    }
}
