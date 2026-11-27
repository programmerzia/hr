<?php

namespace App\Domain\Reports;

/**
 * The shape every tabular report returns, so one on-screen view and one CSV writer serve them all.
 * Column types: text, int, dec (2 decimals), hours, money, date, datetime, pct.
 */
final class Table
{
    /** @param list<array{key:string,label:string,type?:string}> $columns @param list<array<string,mixed>> $rows */
    public static function make(array $columns, array $rows, ?array $totals = null, ?array $secondary = null, ?array $extra = null): array
    {
        return [
            'columns' => array_map(fn ($c) => ['key' => $c[0] ?? $c['key'], 'label' => $c[1] ?? $c['label'], 'type' => $c[2] ?? ($c['type'] ?? 'text')], $columns),
            'rows' => $rows,
            'totals' => $totals,
            'secondary' => $secondary,
            'extra' => $extra,
        ];
    }

    public static function hours(int|float $seconds): float
    {
        return round($seconds / 3600, 2);
    }

    public static function hoursFromMinutes(int|float $minutes): float
    {
        return round($minutes / 60, 2);
    }
}
