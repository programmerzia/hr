<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Services\Grading;
use App\Domain\Leave\Services\BalanceService;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\RegularizationRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Port of decideRegularization(): approving sets is_regularized and re-grades the day with the chosen resolution
 * (excused | paid_leave | unpaid_leave | keep; default excused). paid_leave books an approved LeaveRequest for the
 * missing share of the day (reason "Regularised absence") and moves it to `used` on the balance.
 */
class DecideRegularization
{
    public const RESOLUTIONS = ['excused', 'paid_leave', 'unpaid_leave', 'keep'];

    public function __invoke(RegularizationRequest $req, string $decision, ?string $note, Employee $decider, ?string $resolution = null, ?string $leaveTypeId = null): bool
    {
        if ($req->status !== 'pending') {
            return false;
        }
        $resolution = $decision === 'approved' ? ($resolution ?: 'excused') : null;

        DB::transaction(function () use ($req, $decision, $note, $decider, $resolution, $leaveTypeId) {
            $day = $req->day()->lockForUpdate()->first();
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
            }
        });

        return true;
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
