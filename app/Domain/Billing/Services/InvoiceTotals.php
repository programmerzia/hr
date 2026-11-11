<?php

namespace App\Domain\Billing\Services;

/** Money is whole currency units. Mirrors computeTotals in resources/js/pages/Billing/helpers.ts. */
final class InvoiceTotals
{
    public static function amount(float $qty, int $unitPrice): int
    {
        return (int) round($qty * $unitPrice);
    }

    /**
     * @param  list<array{qty: float|int, unit_price: int}>  $lines
     * @return array{subtotal: int, tax: int, total: int}
     */
    public static function compute(array $lines, float $taxPercent, int $discount): array
    {
        $subtotal = 0;
        foreach ($lines as $l) {
            $subtotal += self::amount((float) $l['qty'], (int) $l['unit_price']);
        }
        $tax = (int) round($subtotal * $taxPercent / 100);

        return ['subtotal' => $subtotal, 'tax' => $tax, 'total' => $subtotal + $tax - $discount];
    }
}
