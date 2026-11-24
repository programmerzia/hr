<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\Scope;
use App\Domain\Attendance\Support\AttendanceNotification;
use App\Models\AttendanceDay;
use App\Models\RegularizationRequest;

/** Port of requestRegularization(), extended with kinds (late, early, absent, auto_closed). Returns an error message, or null on success. */
class RequestRegularization
{
    public const KINDS = ['late', 'early', 'absent', 'auto_closed'];

    public function __invoke(AttendanceDay $day, string $reason, string $kind = 'late'): ?string
    {
        $reason = trim($reason);
        if ($day->is_regularized || $reason === '' || ! $this->applies($day, $kind)) {
            return 'Could not send the request.';
        }
        // Past days, or today once it has ended: a running day is still changing.
        $date = $day->date->format('Y-m-d');
        if ($date > now()->toDateString() || ($date === now()->toDateString() && $day->status !== 'ended')) {
            return 'You can regularise a day once it has ended.';
        }
        if (RegularizationRequest::where('attendance_day_id', $day->id)->where('status', 'pending')->exists()) {
            return 'A request for this day is already pending.';
        }
        RegularizationRequest::create([
            'attendance_day_id' => $day->id,
            'employee_id' => $day->employee_id,
            'reason' => $reason,
            'kind' => $kind,
            'status' => 'pending',
        ]);
        $this->notifyDeciders($day);

        return null;
    }

    /** The lead; view_company holders when the person has no lead (manage_access holders when none). Never the requester. */
    private function notifyDeciders(AttendanceDay $day): void
    {
        $employee = $day->employee;
        $users = Scope::deciders($employee);
        $label = $day->date->format('D, M j');
        foreach ($users as $u) {
            $u->notify(new AttendanceNotification("{$employee->name} asked to regularise {$label}", null, '/team/regularizations'));
        }
    }

    private function applies(AttendanceDay $day, string $kind): bool
    {
        return match ($kind) {
            'late' => $day->late_minutes > 0,
            'early' => $day->early_minutes > 0,
            'absent' => in_array($day->absence_kind, ['unapproved', 'half_day'], true) || $day->status === 'absent',
            'auto_closed' => (bool) $day->auto_closed,
            default => false,
        };
    }
}
