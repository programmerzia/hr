<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use Carbon\CarbonInterface;

/** Presence for team views: a working person whose last heartbeat is older than the idle timeout is offline. */
final class Presence
{
    /** @return array{state:string, offline_since:?CarbonInterface} */
    public static function of(?AttendanceDay $day, ?CarbonInterface $lastSeen, CarbonInterface $now): array
    {
        $status = $day?->status;
        $state = match ($status) {
            'working' => 'working',
            'on_break' => 'on_break',
            'ended' => 'ended',
            'on_leave' => 'on_leave',
            default => 'not_started',
        };
        if ($state === 'working' && $lastSeen
            && $now->getTimestamp() - $lastSeen->getTimestamp() > AttendancePolicy::current()->idle_timeout_minutes * 60) {
            return ['state' => 'offline', 'offline_since' => $lastSeen];
        }

        return ['state' => $state, 'offline_since' => null];
    }
}
