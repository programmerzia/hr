<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\Grading;
use App\Domain\Attendance\Services\Paused;
use App\Domain\Attendance\Services\PayrollLock;
use App\Domain\Attendance\Support\AttendanceNotification;
use App\Domain\Leave\Services\BalanceService;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\RegularizationRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Port of decideRegularization(): approving sets is_regularized and re-grades the day with the chosen resolution
 * (excused | paid_leave | unpaid_leave | keep; default excused). paid_leave books an approved LeaveRequest for the
 * missing share of the day (reason "Regularised absence") and moves it to `used` on the balance.
 *
 * Kind `paused` (the browser paused the HR tab): approving turns those offline stretches into work and re-grades the
 * day from the new totals; no resolution, and the day is not marked regularised (late/early can still be asked for).
 * Refused (validation error `payroll`) when the day's month payroll is no longer open.
 */
class DecideRegularization
{
    public const RESOLUTIONS = ['excused', 'paid_leave', 'unpaid_leave', 'keep'];

    public function __invoke(RegularizationRequest $req, string $decision, ?string $note, Employee $decider, ?string $resolution = null, ?string $leaveTypeId = null): bool
    {
        if ($req->status !== 'pending') {
            return false;
        }
        PayrollLock::assertOpen($req->day->date->format('Y-m-d'));
        $paused = $req->kind === 'paused';
        $resolution = $decision === 'approved' && ! $paused ? ($resolution ?: 'excused') : null;

        DB::transaction(function () use ($req, $decision, $note, $decider, $resolution, $leaveTypeId, $paused) {
            $day = $req->day()->lockForUpdate()->first();
            if ($paused) {
                $req->update(['status' => $decision, 'decided_by' => $decider->id, 'decided_at' => now(), 'note' => trim((string) $note) ?: null]);
                if ($decision === 'approved') {
                    Paused::countAsWork($day);
                    if (! in_array($day->status, ['working', 'on_break'], true)) {
                        Grading::apply($day);
                    }
                    $day->save();
                }

                return;
            }
            if ($resolution === 'paid_leave') {
                $this->bookPaidLeave($req, $day, $leaveTypeId);
            }
            $req->update([
                'status' => $decision,
                'decided_by' => $decider->id,
                'decided_at' => now(),
                'note' => trim((string) $note) ?: null,
                'resolution' => $resolution,
                'leave_type_id' => $resolution === 'paid_leave' ? $leaveTypeId : null,
            ]);
            if ($decision === 'approved') {
                $day->is_regularized = true;
                Grading::apply($day);
                $day->save();
                if ($resolution === 'paid_leave') {
                    $date = $day->date->format('Y-m-d');
                    app(RegradeDays::class)($day->employee_id, $date, $date);
                }
            }
        });
        $this->notifyRequester($req, $decision, trim((string) $note));

        return true;
    }

    private function notifyRequester(RegularizationRequest $req, string $decision, string $note): void
    {
        $label = $req->day->date->format('D, M j');
        $title = "Your regularisation for {$label} was ".($decision === 'approved' ? 'approved' : 'rejected');
        User::where('employee_id', $req->employee_id)->first()
            ?->notify(new AttendanceNotification($title, $note !== '' ? $note : null, '/my-day'));
    }

    private function bookPaidLeave(RegularizationRequest $req, $day, ?string $leaveTypeId): void
    {
        $type = $leaveTypeId ? LeaveType::find($leaveTypeId) : null;
        if (! $type || ! $type->is_paid) {
            throw ValidationException::withMessages(['leave_type_id' => 'Pick a paid leave type.']);
        }
        $days = max(0.5, 1 - (float) $day->day_fraction);
        $date = $day->date->format('Y-m-d');
        $balance = app(BalanceService::class)->find($day->employee_id, $type->id, (int) $day->date->format('Y'));
        if (! $balance || ($balance['available'] !== null && $balance['available'] < $days)) {
            throw ValidationException::withMessages(['leave_type_id' => 'Not enough leave balance.']);
        }
        $leave = LeaveRequest::create([
            'employee_id' => $day->employee_id,
            'leave_type_id' => $type->id,
            'starts_on' => $date,
            'ends_on' => $date,
            'half_day' => $days == 0.5 ? 'second_half' : 'none',
            'days' => $days,
            'reason' => 'Regularised absence',
            'status' => 'approved',
        ]);
        app(BalanceService::class)->adjust($leave, used: $days);
    }
}
