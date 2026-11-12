<?php

namespace App\Domain\Settings;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Models\AttendancePolicy;
use Carbon\CarbonImmutable;

/** Pure what-if numbers for the payroll policy form. Reads policy fields only; no calculator internals. */
final class PolicyPreview
{
    public const LATES = 3;

    /**
     * @param  array<string,mixed>  $p  payroll policy fields
     * @return array<string,mixed>
     */
    public static function compute(array $p, int $gross, string $monthOf, ?AttendancePolicy $attendance = null): array
    {
        $d = CarbonImmutable::parse($monthOf);
        $basis = $p['daily_rate_basis'] ?? 'working_days';
        $divisor = match ($basis) {
            'calendar_days' => $d->daysInMonth,
            'fixed_30' => 30,
            'fixed_26' => 26,
            default => count(PayrollPeriod::workingDates($d->year, $d->month, $attendance)),
        };
        $rate = $divisor > 0 ? $gross / $divisor : 0.0;

        $lop = ! empty($p['lop_enabled']);
        $lateOn = ! empty($p['late_penalty_enabled']);
        $per = max(1, (int) ($p['lates_per_penalty'] ?? 3));
        $units = intdiv(self::LATES, $per);
        $lateDays = $lateOn ? min($units * (float) ($p['penalty_days'] ?? 0), (float) ($p['max_penalty_days_per_month'] ?? 0)) : 0.0;

        return [
            'month' => $d->format('F Y'),
            'gross' => $gross,
            'basis' => $basis,
            'divisor' => $divisor,
            'daily_rate' => round($rate, 2),
            'absence' => $lop ? (int) round($rate) : 0,
            'half_day' => $lop ? (int) round($rate / 2) : 0,
            'lates' => $lateOn ? (int) round($rate * $lateDays) : 0,
            'late_days' => $lateDays,
        ];
    }
}
