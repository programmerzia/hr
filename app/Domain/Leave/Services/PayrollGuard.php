<?php

namespace App\Domain\Leave\Services;

use App\Domain\Leave\Actions\Fail;
use App\Models\PayrollRun;
use Carbon\CarbonImmutable;

/** Leave may be backdated until payroll for a covered month stops being editable (docs/09 C2). */
final class PayrollGuard
{
    public static function assertOpen(string $start, string $end): void
    {
        $from = CarbonImmutable::parse($start)->startOfMonth();
        $to = CarbonImmutable::parse($end)->startOfMonth();
        for ($m = $from; $m <= $to; $m = $m->addMonth()) {
            $run = PayrollRun::where(['year' => $m->year, 'month' => $m->month, 'kind' => 'regular'])->get()
                ->first(fn (PayrollRun $r) => ! $r->isOpen());
            if ($run) {
                Fail::with('Payroll for '.$m->format('F Y').' is already approved; ask HR to adjust it there.');
            }
        }
    }
}
