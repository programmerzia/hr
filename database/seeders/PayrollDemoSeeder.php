<?php

namespace Database\Seeders;

use App\Domain\Payroll\Actions\DraftRun;
use App\Domain\Payroll\Services\PayrollCalculator;
use App\Domain\Payroll\Services\PayrollFacts;
use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Models\ActivityLogEntry;
use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\PayrollAdjustment;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;
use Illuminate\Database\Seeder;

/**
 * Three paid months (Aug to Oct 2026) and a November draft. Exercises proration: Imran Kabir (VIV-109) joins on
 * 25 August, and Sadia Sultana (VIV-107) gets a raise effective 16 October (two salary slices that month).
 */
class PayrollDemoSeeder extends Seeder
{
    /** @var array<string, list<array{string,string,string,int,?string}>> code, kind, label, amount, note */
    private const ADJUSTMENTS = [
        '2026-08' => [['VIV-107', 'bonus', 'Project delivery bonus', 10000, 'Pulse v1 launch']],
        '2026-09' => [
            ['VIV-111', 'deduction', 'Laptop damage recovery', 3000, 'Instalment 1 of 3'],
            ['VIV-119', 'bonus', 'Referral bonus', 5000, null],
        ],
        '2026-10' => [
            ['VIV-111', 'deduction', 'Laptop damage recovery', 3000, 'Instalment 2 of 3'],
            ['VIV-103', 'bonus', 'Festival bonus', 20000, 'Eid-ul-Adha carry over'],
        ],
        '2026-11' => [
            ['VIV-111', 'deduction', 'Laptop damage recovery', 3000, 'Instalment 3 of 3'],
            ['VIV-116', 'bonus', 'Design award', 7500, 'Quarterly recognition'],
        ],
    ];

    public function run(): void
    {
        if (PayrollRun::exists()) {
            return;
        }
        $hr = Employee::where('code', 'VIV-102')->first() ?? Employee::whereHas('user', fn ($q) => $q->where('role', 'hr'))->first();
        $mgmt = Employee::where('code', 'VIV-101')->first() ?? Employee::whereHas('user', fn ($q) => $q->where('role', 'management'))->first();
        if (! $hr || ! $mgmt) {
            return;
        }
        $this->prorationCases();
        foreach ([[2026, 8], [2026, 9], [2026, 10]] as [$y, $m]) {
            $this->paid($y, $m, $hr, $mgmt);
        }
        $this->draft(2026, 11, $hr);
    }

    private function key(int $y, int $m): string
    {
        return sprintf('%d-%02d', $y, $m);
    }

    private function adjustmentsFor(int $y, int $m): array
    {
        return self::ADJUSTMENTS[$this->key($y, $m)] ?? [];
    }

    /** Adjust existing seed rows (no new people): a joiner on the 25th and a mid-month raise. */
    private function prorationCases(): void
    {
        $joiner = Employee::where('code', 'VIV-109')->first();
        if ($joiner) {
            $joiner->update(['joined_on' => '2026-08-25']);
            $latest = SalaryStructure::where('employee_id', $joiner->id)->orderByDesc('effective_from')->first();
            SalaryStructure::where('employee_id', $joiner->id)->where('id', '!=', $latest?->id)->delete();
            $latest?->update(['effective_from' => '2026-08-25']);
        }
        $raised = Employee::where('code', 'VIV-107')->first();
        $current = $raised ? SalaryStructure::where('employee_id', $raised->id)->orderByDesc('effective_from')->first() : null;
        if ($current && $current->effective_from->format('Y-m-d') < '2026-10-16') {
            $gross = 165000;
            $basic = (int) round($gross * 0.55);
            $house = (int) round($gross * 0.25);
            $medical = (int) round($gross * 0.1);
            SalaryStructure::create([
                'employee_id' => $raised->id, 'effective_from' => '2026-10-16', 'basic' => $basic, 'house_rent' => $house,
                'medical' => $medical, 'conveyance' => $gross - $basic - $house - $medical, 'pf_percent' => $current->pf_percent,
                'tax_monthly' => (int) round($current->tax_monthly * 1.1), 'gross' => $gross, 'hourly_rate' => (int) round($gross / 22 / 8),
                'note' => 'Annual review',
            ]);
        }
    }

    private function paid(int $y, int $m, Employee $hr, Employee $mgmt): void
    {
        $attendance = AttendancePolicy::forDate(PayrollPeriod::end($y, $m));
        $money = PayrollPolicy::forDate(PayrollPeriod::end($y, $m));
        $last = PayrollPeriod::end($y, $m);
        $approvedAt = now()->parse($last)->subDays(3)->setTime(16, 0);
        $paidAt = now()->parse($last)->setTime(11, 30);
        $ref = sprintf('BEFTN-%d%02d-001', $y, $m);
        $run = PayrollRun::create([
            'year' => $y, 'month' => $m, 'kind' => 'regular', 'status' => 'paid', 'approved_by' => $mgmt->id, 'approved_at' => $approvedAt,
            'paid_at' => $paidAt, 'payment_reference' => $ref, 'locked_at' => $approvedAt,
        ]);
        $plan = collect($this->adjustmentsFor($y, $m));
        foreach (PayrollPeriod::eligible($y, $m)->values() as $i => $e) {
            // Past months have no attendance rows in the demo, so the attendance facts are synthesised.
            $facts = PayrollFacts::for($e, $y, $m, $attendance, $money);
            if ($facts['slices'] === []) {
                continue;
            }
            $absent = ($i * 5 + $m) % 13 === 0 ? 1 : 0;
            $std = (int) $attendance->standard_minutes;
            $facts = [
                ...$facts,
                'absent_days' => (float) $absent, 'half_days' => 0.0,
                'day_fraction_total' => $facts['eligible_days'] - $absent,
                'late_count' => ($i * 3 + $m) % 5,
                'worked_minutes' => (int) max(0, ($facts['eligible_days'] - $absent) * $std + ((($i * 7 + $m) % 5) - 2) * 90),
            ];
            $adjs = $plan->where(0, $e->code)->values();
            $values = PayrollCalculator::compute($money, $facts['slices'], $facts, $adjs->map(fn ($a) => ['kind' => $a[1], 'amount' => $a[3]])->all());
            $item = PayrollItem::create([
                'run_id' => $run->id, 'employee_id' => $e->id, ...$values,
                'payroll_policy_id' => $money->id, 'attendance_policy_id' => $attendance->id, 'snapshot_at' => $approvedAt,
                'bank_account_id' => $e->bankAccounts()->where('is_primary', true)->value('id'),
                'payslip_path' => sprintf('payslips/%s-%d-%02d.pdf', $e->code, $y, $m),
            ]);
            foreach ($adjs as [, $kind, $label, $amount, $note]) {
                PayrollAdjustment::create(['item_id' => $item->id, 'kind' => $kind, 'label' => $label, 'amount' => $amount, 'note' => $note, 'created_by' => $hr->id]);
            }
        }
        $day = fn (int $n) => now()->setDate($y, $m, $n)->setTime(10, 0);
        $events = [
            [$day(20), $hr, 'started the run'],
            [$day(24), $hr, 'sent the run for review'],
            [$approvedAt, $mgmt, 'approved and locked the run'],
            [$paidAt, $hr, "marked the run as paid ({$ref})"],
        ];
        foreach ($events as [$at, $actor, $text]) {
            $this->event($run, $actor, $text, $at);
        }
    }

    private function draft(int $y, int $m, Employee $hr): void
    {
        $run = app(DraftRun::class)($y, $m, $hr);
        ActivityLogEntry::where('subject_id', $run->id)->update(['created_at' => '2026-11-03 10:00:00', 'updated_at' => '2026-11-03 10:00:00']);
        $builder = app(RunBuilder::class);
        foreach ($this->adjustmentsFor($y, $m) as [$code, $kind, $label, $amount, $note]) {
            $item = PayrollItem::where('run_id', $run->id)->whereHas('employee', fn ($q) => $q->where('code', $code))->first();
            if ($item) {
                $builder->adjustment($item, $kind, $label, $amount, $note, $hr);
                $builder->reprice($item->refresh());
            }
        }
    }

    private function event(PayrollRun $run, Employee $actor, string $text, $at): void
    {
        $e = ActivityLogEntry::create(['subject_type' => 'payroll_run', 'subject_id' => $run->id, 'actor_id' => $actor->id, 'description' => $text]);
        $e->forceFill(['created_at' => $at, 'updated_at' => $at])->save();
    }
}
