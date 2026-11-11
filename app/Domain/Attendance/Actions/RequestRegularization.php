<?php

namespace App\Domain\Attendance\Actions;

use App\Models\AttendanceDay;
use App\Models\RegularizationRequest;

/** Port of requestRegularization(). Returns an error message, or null on success. */
class RequestRegularization
{
    public function __invoke(AttendanceDay $day, string $reason): ?string
    {
        $reason = trim($reason);
        if ($day->late_minutes <= 0 || $day->is_regularized || $reason === '') {
            return 'Could not send the request.';
        }
        if (RegularizationRequest::where('attendance_day_id', $day->id)->where('status', 'pending')->exists()) {
            return 'A request for this day is already pending.';
        }
        RegularizationRequest::create([
            'attendance_day_id' => $day->id,
            'employee_id' => $day->employee_id,
            'reason' => $reason,
            'status' => 'pending',
        ]);

        return null;
    }
}
