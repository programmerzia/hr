<?php

namespace App\Domain\Leave\Services;

use App\Models\LeaveType;
use Carbon\CarbonInterface;

/** Pure entitlement maths: pro-rating a yearly quota for people who join part-way through the year. */
final class Entitlement
{
    /**
     * quota x remaining months / 12, rounded to the nearest half day. The joining month counts when the
     * person joined on or before the 15th. Joined before the year = full quota; after it = 0.
     */
    public static function prorated(LeaveType $type, CarbonInterface $joinedOn, int $year): float
    {
        $quota = (float) $type->annual_quota;
        $joinedYear = (int) $joinedOn->format('Y');
        if ($joinedYear < $year) {
            return $quota;
        }
        if ($joinedYear > $year) {
            return 0.0;
        }
        $month = (int) $joinedOn->format('n');
        $months = 12 - $month + ((int) $joinedOn->format('j') <= 15 ? 1 : 0);

        return round($quota * $months / 12 * 2) / 2;
    }
}
