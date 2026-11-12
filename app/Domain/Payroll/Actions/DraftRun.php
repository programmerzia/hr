<?php

namespace App\Domain\Payroll\Actions;

use App\Domain\Payroll\Services\PayrollPeriod;
use App\Domain\Payroll\Services\RunBuilder;
use App\Domain\Payroll\Support\Fail;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/** Starts a regular, festival bonus or final settlement run (docs/07 §2). */
class DraftRun
{
    public function __construct(private RunBuilder $builder) {}

    public function __invoke(int $year, int $month, Employee $by, string $kind = 'regular', ?float $bonusPercent = null, ?string $label = null, ?Employee $subject = null): PayrollRun
    {
        return match ($kind) {
            'festival' => $this->festival($year, $month, $by, $bonusPercent, $label),
            'settlement' => $this->settlement($subject, $by),
            default => $this->regular($year, $month, $by),
        };
    }

    private function regular(int $year, int $month, Employee $by): PayrollRun
    {
        $exists = 'A run for '.PayrollPeriod::label($year, $month).' already exists.';

        return DB::transaction(function () use ($year, $month, $by, $exists) {
            if (PayrollRun::where('year', $year)->where('month', $month)->where('kind', 'regular')->lockForUpdate()->exists()) {
                Fail::with($exists);
            }

            return $this->create(['year' => $year, 'month' => $month, 'kind' => 'regular'], $by, 'started the run', $exists);
        });
    }

    private function festival(int $year, int $month, Employee $by, ?float $percent, ?string $label): PayrollRun
    {
        $label = trim((string) $label);
        if ($label === '') {
            Fail::with('Name the bonus, for example "Eid-ul-Fitr bonus".');
        }
        if ($percent === null || $percent < 1 || $percent > 200) {
            Fail::with('Bonus must be between 1% and 200% of basic.');
        }
        $exists = 'A festival bonus run named "'.$label.'" already exists for '.PayrollPeriod::label($year, $month).'.';

        return DB::transaction(function () use ($year, $month, $by, $percent, $label, $exists) {
            $dup = PayrollRun::where('year', $year)->where('month', $month)->where('kind', 'festival')->lockForUpdate()->get()
                ->contains(fn ($r) => mb_strtolower((string) $r->label) === mb_strtolower($label));
            if ($dup) {
                Fail::with($exists);
            }

            return $this->create(
                ['year' => $year, 'month' => $month, 'kind' => 'festival', 'label' => $label, 'bonus_percent_of_basic' => $percent],
                $by, "started the run ({$label}, {$percent}% of basic)", $exists,
            );
        });
    }

    private function settlement(?Employee $employee, Employee $by): PayrollRun
    {
        if (! $employee || ! in_array($employee->status, ['resigned', 'terminated'], true) || ! $employee->exited_on) {
            Fail::with('Set the employee to resigned or terminated with an exit date first.');
        }
        if ($employee->employment_type !== 'full_time') {
            Fail::with('Only full-time employees are paid through payroll.');
        }
        $year = (int) $employee->exited_on->format('Y');
        $month = (int) $employee->exited_on->format('n');
        $exists = $employee->name.' already has a final settlement run.';

        return DB::transaction(function () use ($employee, $by, $year, $month, $exists) {
            if (PayrollRun::where('kind', 'settlement')->where('employee_id', $employee->id)->lockForUpdate()->exists()) {
                Fail::with($exists);
            }
            $regular = PayrollRun::where('kind', 'regular')->where('year', $year)->where('month', $month)->first();
            if ($regular && ! $regular->isOpen() && PayrollItem::where('run_id', $regular->id)->where('employee_id', $employee->id)->exists()) {
                Fail::with('The '.PayrollPeriod::label($year, $month).' regular run already includes '.$employee->name.' and is locked.');
            }
            $run = $this->create(
                ['year' => $year, 'month' => $month, 'kind' => 'settlement', 'employee_id' => $employee->id],
                $by, 'started the final settlement for '.$employee->name, $exists,
            );
            if ($regular?->isOpen()) {
                $skipped = $this->builder->recompute($regular);
                $this->builder->log($regular, $by, 'recomputed after a final settlement run was started');
                $this->builder->logSkipped($regular, $by, $skipped);
            }

            return $run;
        });
    }

    /** @param array<string,mixed> $attributes */
    private function create(array $attributes, Employee $by, string $log, string $exists): PayrollRun
    {
        try {
            $run = PayrollRun::create([...$attributes, 'status' => 'draft']);
        } catch (UniqueConstraintViolationException) {
            Fail::with($exists);
        }
        $skipped = $this->builder->recompute($run);
        $this->builder->log($run, $by, $log);
        $this->builder->logSkipped($run, $by, $skipped);

        return $run;
    }
}
