<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\TrackedTime;
use App\Domain\Billing\Support\Audit;
use App\Domain\Billing\Support\Fail;
use App\Models\ContractorClaim;
use App\Models\Employee;
use Illuminate\Support\Facades\DB;

class GenerateClaim
{
    public static function total(int $claimedMinutes, int $rate, ?int $fixed): int
    {
        return $fixed ?? (int) round(($claimedMinutes / 60) * $rate);
    }

    public function __invoke(Employee $employee, int $year, int $month, ?string $actorId): ContractorClaim
    {
        if ($employee->employment_type !== 'contractor') {
            Fail::with('Claims are only for contractors');
        }

        return DB::transaction(function () use ($employee, $year, $month, $actorId) {
            $existing = ContractorClaim::where(['employee_id' => $employee->id, 'year' => $year, 'month' => $month])->lockForUpdate()->first();
            if ($existing && $existing->status !== 'draft') {
                Fail::with('This month already has a submitted claim');
            }
            $today = now()->format('Y-m-d');
            $salary = $employee->salaryStructures()->get();
            $rate = (int) ($salary->filter(fn ($s) => $s->effective_from->format('Y-m-d') <= $today)->last()?->hourly_rate ?? $salary->last()?->hourly_rate ?? 0);
            $tracked = TrackedTime::minutes($employee->id, $year, $month);
            $fixed = ContractorClaim::where('employee_id', $employee->id)->whereNotNull('fixed_amount')
                ->orderByDesc('year')->orderByDesc('month')->value('fixed_amount');
            $fixed = $fixed === null ? null : (int) $fixed;
            $bank = $employee->bankAccounts()->orderByDesc('is_primary')->first();
            $values = [
                'tracked_minutes' => $tracked, 'claimed_minutes' => $tracked, 'rate' => $rate, 'fixed_amount' => $fixed,
                'total' => self::total($tracked, $rate, $fixed), 'status' => 'draft', 'verified_by' => null,
                'approved_by' => null, 'paid_at' => null, 'bank_account_id' => $bank?->id,
            ];
            if ($existing) {
                $existing->update($values);
                $claim = $existing;
            } else {
                $claim = ContractorClaim::create(['employee_id' => $employee->id, 'year' => $year, 'month' => $month] + $values);
            }
            Audit::log('claim', $claim->id, 'generated the claim from tracked hours', $actorId);

            return $claim;
        });
    }
}
