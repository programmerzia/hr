<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Services\Overtime;
use App\Domain\Attendance\Services\Scope;
use App\Http\Controllers\Controller;
use App\Models\AttendanceDay;
use App\Models\RegularizationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/** Lead / HR approval of overtime minutes per day; the approval is audited as an approved `overtime` regularization row. */
class OvertimeController extends Controller
{
    public function approve(Request $request, AttendanceDay $day): RedirectResponse
    {
        $this->authorizeDay($request, $day);
        $minutes = $request->validate(['minutes' => ['required', 'integer', 'min:1', 'max:1440']], [
            'minutes.*' => 'Enter the overtime minutes to approve.',
        ])['minutes'];
        $this->requireApprovalMode($day);
        $raw = Overtime::raw($day);
        if ($minutes > $raw) {
            throw ValidationException::withMessages(['minutes' => "Only {$raw} minutes of overtime were worked that day."]);
        }
        $this->record($request, $day, $minutes, 'approved', "Overtime approved: {$minutes} min (worked {$raw})");

        return back()->with('success', 'Overtime approved');
    }

    public function revoke(Request $request, AttendanceDay $day): RedirectResponse
    {
        $this->authorizeDay($request, $day);
        $this->record($request, $day, 0, 'rejected', 'Overtime approval revoked');

        return back()->with('success', 'Overtime approval removed');
    }

    private function authorizeDay(Request $request, AttendanceDay $day): void
    {
        $user = $request->user();
        abort_if($user->employee_id === $day->employee_id, 403, 'You cannot approve your own overtime.');
        $inScope = Gate::allows('manage_payroll') || Scope::employees($user)->whereKey($day->employee_id)->exists();
        abort_unless($inScope, 403);
    }

    private function requireApprovalMode(AttendanceDay $day): void
    {
        if (! Overtime::needsApproval($day->date->format('Y-m-d'))) {
            throw ValidationException::withMessages(['minutes' => 'Overtime approval is not required by the payroll policy.']);
        }
    }

    private function record(Request $request, AttendanceDay $day, int $minutes, string $status, string $reason): void
    {
        DB::transaction(function () use ($request, $day, $minutes, $status, $reason) {
            $day = AttendanceDay::lockForUpdate()->findOrFail($day->id);
            $day->update(['approved_overtime_minutes' => $minutes]);
            RegularizationRequest::create([
                'attendance_day_id' => $day->id, 'employee_id' => $day->employee_id, 'kind' => 'overtime',
                'reason' => $reason, 'status' => $status,
                'decided_by' => $request->user()->employee_id, 'decided_at' => now(),
            ]);
        });
    }
}
