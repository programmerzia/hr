<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Support\BillingNotification;
use App\Models\ContractorClaim;
use App\Models\User;
use Carbon\CarbonImmutable;

class ClaimNotifier
{
    private function label(ContractorClaim $c): string
    {
        $h = intdiv($c->claimed_minutes, 60);
        $m = str_pad((string) ($c->claimed_minutes % 60), 2, '0', STR_PAD_LEFT);

        return CarbonImmutable::create($c->year, $c->month, 1)->format('F Y').", {$h}h {$m}m";
    }

    private function send($users, ContractorClaim $c, string $title): void
    {
        $n = new BillingNotification('claim', $title, $this->label($c), "/claims/{$c->id}");
        foreach ($users as $u) {
            $u->notify($n);
        }
    }

    /** Submitted: the contractor's team lead (management when there is no other lead). */
    public function submitted(ContractorClaim $c): void
    {
        $c->loadMissing('employee.team');
        $leadId = $c->employee->team?->lead_employee_id;
        $users = $leadId && $leadId !== $c->employee_id ? User::where('employee_id', $leadId)->get() : collect();
        if ($users->isEmpty()) {
            $users = User::where('role', 'management')->where('employee_id', '!=', $c->employee_id)->get();
        }
        $this->send($users, $c, 'Claim to verify from '.$c->employee->name);
    }

    /** Verified: management approves next. */
    public function verified(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $this->send(User::where('role', 'management')->get(), $c, 'Claim to approve from '.$c->employee->name);
    }

    /** Approved: HR pays (management when no HR user). */
    public function approved(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $users = User::where('role', 'hr')->get();
        if ($users->isEmpty()) {
            $users = User::where('role', 'management')->get();
        }
        $this->send($users, $c, 'Claim to pay for '.$c->employee->name);
    }

    public function paid(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $this->send(User::where('employee_id', $c->employee_id)->get(), $c, 'Your claim was paid');
    }
}
