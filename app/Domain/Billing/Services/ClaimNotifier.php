<?php

namespace App\Domain\Billing\Services;

use App\Domain\Billing\Support\BillingNotification;
use App\Models\ContractorClaim;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

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

    /** Everyone holding the permission except the claimant. @return Collection<int, User> */
    private function holders(string $permission, ContractorClaim $c): Collection
    {
        return User::permission($permission)->get()->reject(fn (User $u) => $u->employee_id === $c->employee_id)->values();
    }

    /** Submitted: the contractor's team lead; verify_claims holders with view_company when there is no other lead (admins as the last resort). */
    public function submitted(ContractorClaim $c): void
    {
        $c->loadMissing('employee.team');
        $leadId = $c->employee->team?->lead_employee_id;
        $users = $leadId && $leadId !== $c->employee_id ? User::where('employee_id', $leadId)->get() : collect();
        if ($users->isEmpty()) {
            $users = $this->holders('verify_claims', $c)->filter(fn (User $u) => $u->checkPermissionTo('view_company'))->values();
        }
        if ($users->isEmpty()) {
            $users = $this->holders('manage_access', $c);
        }
        $this->send($users, $c, 'Claim to verify from '.$c->employee->name);
    }

    /** Verified: approve_claims holders decide next. */
    public function verified(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $this->send($this->holders('approve_claims', $c), $c, 'Claim to approve from '.$c->employee->name);
    }

    /** Approved: manage_payroll holders pay (admins when nobody holds it). */
    public function approved(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $users = $this->holders('manage_payroll', $c);
        if ($users->isEmpty()) {
            $users = $this->holders('manage_access', $c);
        }
        $this->send($users, $c, 'Claim to pay for '.$c->employee->name);
    }

    public function paid(ContractorClaim $c): void
    {
        $c->loadMissing('employee');
        $this->send(User::where('employee_id', $c->employee_id)->get(), $c, 'Your claim was paid');
    }
}
