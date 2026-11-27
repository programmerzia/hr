<?php

namespace App\Domain\Payroll\Support;

/** CSV text for spreadsheets: UTF-8 BOM (Excel reads Bangla names), formula characters neutralised. */
final class Csv
{
    public const BOM = "\xEF\xBB\xBF";

    /** @param list<string> $header @param list<list<string|int|float|null>> $rows */
    public static function render(array $header, array $rows): string
    {
        $h = fopen('php://temp', 'r+');
        fputcsv($h, $header, escape: '');
        foreach ($rows as $row) {
            fputcsv($h, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'".$v : $v, $row), escape: '');
        }
        rewind($h);
        $out = stream_get_contents($h);
        fclose($h);

        return self::BOM.$out;
    }
}
