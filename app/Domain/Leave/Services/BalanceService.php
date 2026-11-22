<?php

namespace App\Domain\Leave\Services;

use App\Models\AttendancePolicy;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;

class BalanceService
{
    public static function isUnlimited(LeaveType $type): bool
    {
        return ! $type->is_paid && (float) $type->annual_quota === 0.0;
    }

    /** @return list<string> */
    public function holidayDates(): array
    {
        return Holiday::query()->pluck('date')->map(fn ($d) => $d->format('Y-m-d'))->all();
    }

    public function daysFor(string $start, string $end, string $half): float
    {
        return LeaveDays::count($start, $end, $half, $this->holidayDates(), array_map('intval', AttendancePolicy::current()->weekend_days ?? [5, 6]));
    }

    /**
     * Balance rows for the year, one per leave type. A missing row is synthesised (not stored) from the type quota.
     *
     * @return list<array{balance: LeaveBalance, type: LeaveType, unlimited: bool, available: float|null}>
     */
    public function forEmployee(Employee|string $employee, int $year): array
    {
        $employeeId = $employee instanceof Employee ? $employee->id : $employee;
        $rows = LeaveBalance::where('employee_id', $employeeId)->where('year', $year)->get()->keyBy('leave_type_id');
        $out = [];
        foreach (LeaveType::orderBy('created_at')->orderBy('name')->get() as $type) {
            $row = $rows[$type->id] ?? null;
            if (! $row) {
                if (! (self::isUnlimited($type) || (float) $type->annual_quota > 0)) {
                    continue;
                }
                $emp = $employee instanceof Employee ? $employee : Employee::find($employeeId);
                $entitled = $emp && $emp->employment_type === 'contractor' ? 0.0
                    : ($emp ? Entitlement::prorated($type, $emp->joined_on, $year) : (float) $type->annual_quota);
                $row = new LeaveBalance([
                    'employee_id' => $employeeId, 'leave_type_id' => $type->id, 'year' => $year,
                    'entitled' => $entitled, 'used' => 0, 'pending' => 0, 'carried_in' => 0, 'encashed' => 0,
                ]);
                $row->id = "synthetic-{$employeeId}-{$type->id}-{$year}";
            }
            $unlimited = self::isUnlimited($type);
            $out[] = [
                'balance' => $row, 'type' => $type, 'unlimited' => $unlimited,
                'available' => $unlimited ? null : max(0.0, (float) $row->entitled + (float) $row->carried_in - (float) $row->used - (float) $row->pending),
            ];
        }

        return $out;
    }

    /** @return array{balance: LeaveBalance, type: LeaveType, unlimited: bool, available: float|null}|null */
    public function find(string $employeeId, string $typeId, int $year): ?array
    {
        foreach ($this->forEmployee($employeeId, $year) as $row) {
            if ($row['type']->id === $typeId) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Working days of a range per calendar year (all years with leave in them).
     *
     * @return array<int, float>
     */
    public function daysByYear(string $start, string $end, string $half): array
    {
        return LeaveDays::splitByYear($start, $end, $half, $this->holidayDates(), array_map('intval', AttendancePolicy::current()->weekend_days ?? [5, 6]));
    }

    /**
     * The request's stored `days` split per calendar year. A single-year request is all in that year; a cross-year
     * one uses the split stored at submit (older rows: split from the current holidays, with any drift put on the first year), so
     * submit, approve, reject and cancel always move the same amounts.
     *
     * @return array<int, float>
     */
    public function slices(LeaveRequest $r): array
    {
        $start = $r->starts_on->format('Y-m-d');
        $end = $r->ends_on->format('Y-m-d');
        $total = (float) $r->days;
        if ($r->starts_on->format('Y') === $r->ends_on->format('Y')) {
            return [(int) $r->starts_on->format('Y') => $total];
        }
        if (is_array($r->year_split) && $r->year_split !== []) {
            $stored = [];
            foreach ($r->year_split as $year => $d) {
                $stored[(int) $year] = (float) $d;
            }

            return $stored;
        }
        $split = $this->daysByYear($start, $end, (string) $r->half_day ?: 'none');
        if ($split === []) {
            return [(int) $r->starts_on->format('Y') => $total];
        }
        $drift = $total - array_sum($split);
        if (abs($drift) > 0.001) {
            $first = array_key_first($split);
            $split[$first] = max(0.0, $split[$first] + $drift);
        }

        return $split;
    }

    /** The stored balance row, created like ProvisionBalances does (pro-rated, contractors 0). */
    public function ensureRow(string $employeeId, string $typeId, int $year): LeaveBalance
    {
        $row = LeaveBalance::where(['employee_id' => $employeeId, 'leave_type_id' => $typeId, 'year' => $year])->lockForUpdate()->first();
        if ($row) {
            return $row;
        }
        $emp = Employee::find($employeeId);
        $type = LeaveType::find($typeId);
        $entitled = ! $type ? 0.0
            : ($emp ? ($emp->employment_type === 'contractor' ? 0.0 : Entitlement::prorated($type, $emp->joined_on, $year)) : (float) $type->annual_quota);

        return LeaveBalance::create([
            'employee_id' => $employeeId, 'leave_type_id' => $typeId, 'year' => $year,
            'entitled' => $entitled, 'used' => 0, 'pending' => 0,
        ]);
    }

    /** Applies a delta (total days) to the stored balance rows of the request, each year taking its own share. */
    public function adjust(LeaveRequest $r, float $used = 0, float $pending = 0): void
    {
        $slices = $this->slices($r);
        $total = (float) $r->days;
        foreach ($slices as $year => $days) {
            $share = $total > 0 ? $days / $total : 1.0;
            $row = $this->ensureRow($r->employee_id, $r->leave_type_id, $year);
            $row->update([
                'used' => max(0, (float) $row->used + round($used * $share, 2)),
                'pending' => max(0, (float) $row->pending + round($pending * $share, 2)),
            ]);
        }
    }
}
