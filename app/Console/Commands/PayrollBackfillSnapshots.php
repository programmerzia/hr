<?php

namespace App\Console\Commands;

use App\Models\AttendancePolicy;
use App\Models\PayrollItem;
use App\Models\PayrollPolicy;
use App\Models\PayrollRun;
use App\Models\SalaryStructure;
use Illuminate\Console\Command;

/** One-off (docs/07 §3): give pre-upgrade payroll items a snapshot from their linked structure. Idempotent. */
class PayrollBackfillSnapshots extends Command
{
    protected $signature = 'payroll:backfill-snapshots';

    protected $description = 'Fill components, slices and policy ids on payroll items created before the snapshot upgrade';

    public function handle(): int
    {
        $payrollPolicy = PayrollPolicy::orderBy('effective_from')->value('id');
        $attendancePolicy = AttendancePolicy::orderBy('effective_from')->value('id');
        $n = 0;
        PayrollItem::whereNull('components')->chunkById(200, function ($items) use ($payrollPolicy, $attendancePolicy, &$n) {
            $structures = SalaryStructure::whereIn('id', $items->pluck('salary_structure_id'))->get()->keyBy('id');
            $runs = PayrollRun::whereIn('id', $items->pluck('run_id'))->get()->keyBy('id');
            foreach ($items as $item) {
                $s = $structures[$item->salary_structure_id] ?? null;
                $run = $runs[$item->run_id] ?? null;
                if (! $s || ! $run) {
                    continue;
                }
                $item->update([
                    'components' => self::components($s, (int) $item->gross),
                    'slices' => [[
                        'effective_from' => sprintf('%04d-%02d-01', $run->year, $run->month), 'structure_id' => $s->id,
                        'days' => (float) $item->eligible_days, 'gross' => (int) $s->gross, 'gross_share' => (int) $item->gross,
                    ]],
                    'payroll_policy_id' => $item->payroll_policy_id ?? $payrollPolicy,
                    'attendance_policy_id' => $item->attendance_policy_id ?? $attendancePolicy,
                    'snapshot_at' => $item->snapshot_at ?? (in_array($run->status, ['approved', 'paid'], true) ? ($run->locked_at ?? $run->approved_at) : null),
                ]);
                $n++;
            }
        });
        $this->info("Backfilled {$n} payroll items.");

        return self::SUCCESS;
    }

    /** Structure components scaled to the stored gross, rounded so they sum exactly. */
    public static function components(SalaryStructure $s, int $gross): array
    {
        $f = $s->gross > 0 ? $gross / $s->gross : 0;
        $c = [
            'basic' => (int) round($s->basic * $f), 'house_rent' => (int) round($s->house_rent * $f),
            'medical' => (int) round($s->medical * $f), 'conveyance' => 0,
            'other_allowances' => array_map(fn ($a) => ['label' => $a['label'], 'amount' => (int) round($a['amount'] * $f)], $s->otherAllowances()),
        ];
        $c['conveyance'] = $gross - $c['basic'] - $c['house_rent'] - $c['medical'] - array_sum(array_column($c['other_allowances'], 'amount'));

        return [...$c, 'basis' => null, 'divisor' => null, 'daily_rate' => null, 'hourly_rate' => (float) $s->hourly_rate];
    }
}
