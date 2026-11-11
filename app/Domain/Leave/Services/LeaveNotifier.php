<?php

namespace App\Domain\Leave\Services;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Notifications\LeaveRequestNotification;

class LeaveNotifier
{
    /** Lead of the employee's team (null when the person leads it themselves or has no team). */
    public static function leadOf(Employee $employee): ?Employee
    {
        $team = $employee->team;
        if (! $team || ! $team->lead_employee_id || $team->lead_employee_id === $employee->id) {
            return null;
        }

        return Employee::find($team->lead_employee_id);
    }

    private function label(LeaveRequest $r): string
    {
        $r->loadMissing(['employee', 'leaveType']);
        $range = $r->starts_on->format('M j').($r->starts_on->equalTo($r->ends_on) ? '' : ' to '.$r->ends_on->format('M j'));

        return "{$r->leaveType?->name}, {$range}";
    }

    /** Next decider: the lead at pending_lead, HR (management when no HR user) at pending_hr. */
    public function toNextDecider(LeaveRequest $r): void
    {
        $r->loadMissing('employee');
        if ($r->status === 'pending_lead') {
            $lead = self::leadOf($r->employee);
            $users = $lead ? User::where('employee_id', $lead->id)->get() : collect();
        } else {
            $users = User::where('role', 'hr')->get();
            if ($users->isEmpty()) {
                $users = User::where('role', 'management')->get();
            }
            $users = $users->where('employee_id', '!=', $r->employee_id);
        }
        $n = new LeaveRequestNotification(
            'Leave request from '.$r->employee->name, $this->label($r), '/leave/approvals',
        );
        foreach ($users as $u) {
            $u->notify($n);
        }
    }

    public function toRequester(LeaveRequest $r, string $title, ?string $note = null): void
    {
        $user = User::where('employee_id', $r->employee_id)->first();
        $user?->notify(new LeaveRequestNotification($title, trim($this->label($r).($note ? ". {$note}" : '')), '/leave'));
    }
}
