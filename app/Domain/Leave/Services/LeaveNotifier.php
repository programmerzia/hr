<?php

namespace App\Domain\Leave\Services;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\User;
use App\Notifications\LeaveRequestNotification;
use Illuminate\Support\Collection;

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

    /** The lead's sign-in account, or null when the lead has none or the employee is no longer active (then HR decides directly). */
    public static function leadUser(Employee $employee): ?User
    {
        $lead = self::leadOf($employee);
        if (! $lead || ! in_array($lead->status, ['active', 'probation', 'on_leave'], true)) {
            return null;
        }

        return User::where('employee_id', $lead->id)->first();
    }

    /**
     * Everyone who can decide at the HR stage (permission approve_leave_hr), never the requester.
     * Management accounts are the fallback when nobody else holds the permission.
     *
     * @return Collection<int, User>
     */
    public static function hrDeciders(LeaveRequest $r): Collection
    {
        $notRequester = fn ($q) => $q->whereNull('employee_id')->orWhere('employee_id', '!=', $r->employee_id);
        $users = User::permission('approve_leave_hr')->where($notRequester)->get();
        if ($users->isEmpty()) {
            $users = User::where('role', 'management')->where($notRequester)->get();
        }

        return $users;
    }

    /** At pending_lead: the lead, plus an FYI to the HR deciders. At pending_hr: the HR deciders. */
    public function toNextDecider(LeaveRequest $r): void
    {
        $r->loadMissing('employee');
        $name = $r->employee->name;
        $label = $this->label($r);
        if ($r->status === 'pending_lead') {
            $lead = self::leadUser($r->employee);
            $lead?->notify(new LeaveRequestNotification('Leave request from '.$name, $label, '/leave/approvals'));
            $fyi = new LeaveRequestNotification('Leave request from '.$name, $label.($lead ? ". Waiting for {$lead->name}" : ''), '/leave/approvals');
            foreach (self::hrDeciders($r)->reject(fn (User $u) => $u->id === $lead?->id) as $u) {
                $u->notify($fyi);
            }

            return;
        }
        $n = new LeaveRequestNotification('Leave request from '.$name, $label, '/leave/approvals');
        foreach (self::hrDeciders($r) as $u) {
            $u->notify($n);
        }
    }

    /** Tell the lead and the HR deciders something happened to an approved request (never the requester). */
    public function toDeciders(LeaveRequest $r, string $title): void
    {
        $r->loadMissing('employee');
        $n = new LeaveRequestNotification($title, $this->label($r), '/leave/calendar');
        $lead = self::leadUser($r->employee);
        $users = self::hrDeciders($r)->when($lead, fn ($c) => $c->push($lead))->unique('id')
            ->reject(fn (User $u) => $u->employee_id === $r->employee_id);
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
