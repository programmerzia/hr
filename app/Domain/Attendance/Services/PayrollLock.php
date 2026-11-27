<?php

namespace App\Domain\Attendance\Services;

use App\Models\PayrollRun;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Attendance that payroll has already used cannot change: once a month's regular run is no longer open (approved,
 * paid or locked), days in that month are not re-graded, closed, regularised or given overtime. Same rule and wording
 * as the leave side (App\Domain\Leave\Services\PayrollGuard).
 */
final class PayrollLock
{
    public const KEY = 'payroll';

    /** The refusal message when $date's month is locked, otherwise null. */
    public static function message(string $date): ?string
    {
        $m = CarbonImmutable::parse(substr($date, 0, 10));
        $locked = PayrollRun::where(['year' => $m->year, 'month' => $m->month, 'kind' => 'regular'])->get()
            ->contains(fn (PayrollRun $r) => ! $r->isOpen());

        return $locked ? 'Payroll for '.$m->format('F Y').' is already approved; ask HR to adjust it there.' : null;
    }

    public static function locked(string $date): bool
    {
        return self::message($date) !== null;
    }

    /** Throws a validation error (key `payroll`, or $key) when any month in [$from, $to] is locked. */
    public static function assertOpen(string $from, ?string $to = null, string $key = self::KEY): void
    {
        $to ??= $from;
        for ($m = CarbonImmutable::parse(substr($from, 0, 10))->startOfMonth(); $m->toDateString() <= substr($to, 0, 10); $m = $m->addMonth()) {
            if ($msg = self::message($m->toDateString())) {
                throw ValidationException::withMessages([$key => $msg]);
            }
        }
    }
}
