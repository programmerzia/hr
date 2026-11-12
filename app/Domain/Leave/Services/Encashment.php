<?php

namespace App\Domain\Leave\Services;

use App\Models\ActivityLogEntry;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use Illuminate\Support\Facades\DB;

/**
 * Leave encashment at exit (consumed by the settlement run; no payroll code here).
 *
 * Encashment::for($employee, $year) is read-only and returns ['days' => float, 'by_type' => list of
 * ['leave_type_id', 'name', 'days']]: the sum over encashable PAID types of max(0, entitled + carried_in - used - encashed).
 * The settlement multiplies `days` by the daily rate, then calls Encashment::consume() inside its own transaction.
 */
final class Encashment
{
    /** @return array{days: float, by_type: list<array{leave_type_id: string, name: string, days: float}>} */
    public static function for(Employee $employee, int $year): array
    {
        $by = [];
        foreach (self::rows($employee, $year) as ['balance' => $b, 'type' => $t]) {
            $days = max(0.0, (float) $b->entitled + (float) $b->carried_in - (float) $b->used - (float) $b->encashed);
            if ($days > 0) {
                $by[] = ['leave_type_id' => $t->id, 'name' => $t->name, 'days' => $days];
            }
        }

        return ['days' => (float) array_sum(array_column($by, 'days')), 'by_type' => $by];
    }

    /** Marks everything available as encashed (idempotent: a second call finds nothing). Returns what was consumed. */
    public static function consume(Employee $employee, int $year, Employee $by): array
    {
        return DB::transaction(function () use ($employee, $year, $by) {
            $result = ['days' => 0.0, 'by_type' => []];
            foreach (self::rows($employee, $year) as ['balance' => $b, 'type' => $t]) {
                $days = max(0.0, (float) $b->entitled + (float) $b->carried_in - (float) $b->used - (float) $b->encashed);
                if ($days <= 0) {
                    continue;
                }
                if (! $b->exists) {
                    $b->save();
                }
                $b->update(['encashed' => (float) $b->encashed + $days]);
                $result['by_type'][] = ['leave_type_id' => $t->id, 'name' => $t->name, 'days' => $days];
                $result['days'] += $days;
            }
            if ($result['days'] > 0) {
                ActivityLogEntry::create([
                    'subject_type' => 'employee', 'subject_id' => $employee->id, 'actor_id' => $by->id,
                    'description' => "Leave encashed at exit: {$result['days']} days ({$year})",
                    'properties' => $result,
                ]);
            }

            return $result;
        });
    }

    /** @return list<array{balance: LeaveBalance, type: LeaveType}> */
    private static function rows(Employee $employee, int $year): array
    {
        return array_values(array_filter(
            app(BalanceService::class)->forEmployee($employee, $year),
            fn ($r) => $r['type']->encashable && $r['type']->is_paid && ! $r['unlimited'],
        ));
    }
}
