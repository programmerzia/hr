<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\DayState;
use App\Domain\Attendance\Services\Outage;
use App\Domain\Attendance\Services\Reconciler;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Port of session.heartbeat(): reconcile (stale days, offline gap, idle by last input, resume), then
 * last_seen_at = now and a heartbeat tick for outage detection. $gapReason/$gapSince: what the client saw while it
 * sent no beats and when that started (sent on the first beat back). $activityAt is the client's last input time; null (older clients) means "active now".
 * Returns true when the day changed.
 */
class Heartbeat
{
    public function __invoke(User $user, ?CarbonInterface $activityAt = null, ?string $gapReason = null, ?CarbonInterface $gapSince = null): bool
    {
        $employee = $user->employee;
        if (! $employee) {
            return false;
        }

        return DB::transaction(function () use ($user, $activityAt, $gapReason, $gapSince) {
            DayState::findForUpdate($user->employee);
            $now = now();
            $changed = app(Reconciler::class)($user, $now, $activityAt, true, $gapReason, $gapSince);
            Outage::tick($user->id, $now);
            $user->forceFill(['last_seen_at' => $now])->save();

            return $changed;
        });
    }
}
