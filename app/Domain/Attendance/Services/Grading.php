<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceDay;
use App\Models\AttendancePolicy;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\RegularizationRequest;
use App\Models\TimeSegment;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/** Loads the facts DayGrader needs for a stored day (policy by date, weekend, holiday, approved leave, resolution). */
final class Grading
{
    /** @return array{is_weekend:bool, is_holiday:bool, leave_weight:float, leave_paid:bool} */
    public static function calendar(string $employeeId, string $date): array
    {
        $policy = AttendancePolicy::forDate($date);
        $dow = (int) date('w', strtotime($date));
        $leave = LeaveRequest::with('leaveType')->where('employee_id', $employeeId)->where('status', 'approved')
            ->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->get();
        $weight = 0.0;
        $paid = false;
        foreach ($leave as $r) {
            $w = $r->half_day !== 'none' && $r->starts_on->equalTo($r->ends_on) ? 0.5 : 1.0;
            if ($w > $weight) {
                $weight = $w;
                $paid = (bool) $r->leaveType?->is_paid;
            }
        }

        return [
            'is_weekend' => in_array($dow, array_map('intval', $policy->weekend_days ?? [5, 6]), true),
            'is_holiday' => Holiday::whereDate('date', $date)->exists(),
            'leave_weight' => $weight,
            'leave_paid' => $paid,
        ];
    }

    /** True when an approved first-half leave covers the date (the person is not expected in the morning). */
    public static function hasFirstHalfLeave(string $employeeId, string $date): bool
    {
        return LeaveRequest::where('employee_id', $employeeId)->where('status', 'approved')->where('half_day', 'first_half')
            ->whereDate('starts_on', '<=', $date)->whereDate('ends_on', '>=', $date)->exists();
    }

    /** A gap at least this long, starting before shift end, separates the working day from a later evening session. */
    public const EVENING_GAP_MINUTES = 60;

    /** An evening session after such a gap shorter than this (a quick look, a tab reopened) does not cancel early leave. */
    public const EVENING_SESSION_MINUTES = 30;

    /**
     * When the person actually stopped working, for early leave: the end of the last work segment, not the moment the
     * day was closed (an auto-close at the last heartbeat, or a break left open). A short evening session after a long
     * gap that began before shift end is ignored (prod 24 Nov: offline 18:14-22:29, a reopen at 22:29 must not wipe
     * out the 46 minutes of early leave). Null while the day has no last_out_at.
     */
    public static function leftAt(AttendanceDay $day): ?CarbonInterface
    {
        if (! $day->last_out_at) {
            return null;
        }
        $work = TimeSegment::where('attendance_day_id', $day->id)->where('type', 'work')->orderBy('started_at')->get()
            ->map(fn (TimeSegment $s) => [CarbonImmutable::instance($s->started_at), CarbonImmutable::instance($s->ended_at ?? $day->last_out_at)])
            ->filter(fn ($w) => $w[1]->gt($w[0]))->values();
        if ($work->isEmpty()) {
            return $day->last_out_at;
        }
        $date = $day->date->format('Y-m-d');
        $shiftEnd = CarbonImmutable::parse($date.' '.AttendancePolicy::forDate($date)->shift_end, config('app.timezone'));

        // Walk back over evening sessions: work starting after shift end, after a long gap that began before it.
        $end = $work->count();
        $tail = 0;
        for ($i = $work->count() - 1; $i > 0; $i--) {
            [$start, $stop] = $work[$i];
            $prevEnd = $work[$i - 1][1];
            $tail += $stop->getTimestamp() - $start->getTimestamp();
            if ($start->gte($shiftEnd) && $prevEnd->lt($shiftEnd) && $start->getTimestamp() - $prevEnd->getTimestamp() >= self::EVENING_GAP_MINUTES * 60) {
                if ($tail < self::EVENING_SESSION_MINUTES * 60) {
                    $end = $i;
                }
                break;
            }
        }
        $last = $work[$end - 1][1];

        return $last->lt($day->last_out_at) ? $last : $day->last_out_at;
    }

    /** Grades the day and fills day_fraction/absence_kind/late_minutes/early_minutes (does not save). */
    public static function apply(AttendanceDay $day): array
    {
        $date = $day->date->format('Y-m-d');
        $resolution = $day->is_regularized
            ? RegularizationRequest::where('attendance_day_id', $day->id)->whereNotIn('kind', ['overtime', 'paused'])->where('status', 'approved')->latest('decided_at')->value('resolution')
            : null;
        $g = DayGrader::grade(AttendancePolicy::forDate($date), [
            'date' => $date,
            ...self::calendar($day->employee_id, $date),
            'first_in_at' => $day->first_in_at,
            'last_out_at' => self::leftAt($day),
            'work_seconds' => (int) $day->work_seconds,
            'is_regularized' => (bool) $day->is_regularized,
            'regularization_resolution' => $resolution,
        ]);
        $day->fill([
            'day_fraction' => $g['day_fraction'],
            'absence_kind' => $g['absence_kind'],
            'late_minutes' => $g['late_minutes'],
            'early_minutes' => $g['early_minutes'],
        ]);

        return $g;
    }
}
