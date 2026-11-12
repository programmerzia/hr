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

    /** Applies a delta to the stored balance row of the request (created from the type quota when missing). */
    public function adjust(LeaveRequest $r, float $used = 0, float $pending = 0): void
    {
        $year = (int) $r->starts_on->format('Y');
        $row = LeaveBalance::where(['employee_id' => $r->employee_id, 'leave_type_id' => $r->leave_type_id, 'year' => $year])->lockForUpdate()->first();
        if (! $row) {
            $row = LeaveBalance::create([
                'employee_id' => $r->employee_id, 'leave_type_id' => $r->leave_type_id, 'year' => $year,
                'entitled' => LeaveType::find($r->leave_type_id)?->annual_quota ?? 0, 'used' => 0, 'pending' => 0,
            ]);
        }
        $row->update([
            'used' => max(0, (float) $row->used + $used),
            'pending' => max(0, (float) $row->pending + $pending),
        ]);
    }
}
