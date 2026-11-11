<?php

namespace App\Http\Resources;

use Carbon\CarbonInterface;

final class Fmt
{
    public static function dt(?CarbonInterface $v): ?string
    {
        return $v?->copy()->setTimezone(config('app.timezone'))->toIso8601String();
    }

    public static function d(?CarbonInterface $v): ?string
    {
        return $v?->format('Y-m-d');
    }
}
