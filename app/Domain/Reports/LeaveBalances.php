<?php

namespace App\Domain\Reports;

use App\Domain\Leave\Services\BalanceService;
use App\Models\Employee;

/**
 * Entitlement, carried, taken, pending and balance per employee and leave type for the year of the as-of date.
 * Figures are the live ledger (BalanceService); the date picks the year, it does not rewind usage.
 */
final class LeaveBalances
{
    /** @param list<string> $ids @return array<string,mixed> */
    public static function for(string $asOf, array $ids): array
    {
        $year = (int) substr($asOf, 0, 4);
        $svc = new BalanceService;
        $rows = [];
        foreach (Employee::whereIn('id', $ids)->orderBy('name')->get() as $e) {
            foreach ($svc->forEmployee($e, $year) as $b) {
                $row = $b['balance'];
                $rows[] = [
                    'code' => $e->code, 'name' => $e->name, 'type' => $b['type']->name,
                    'entitled' => $b['unlimited'] ? null : (float) $row->entitled, 'carried' => (float) $row->carried_in,
                    'taken' => (float) $row->used, 'pending' => (float) $row->pending,
                    'balance' => $b['unlimited'] ? null : $b['available'],
                ];
            }
        }

        return Table::make([
            ['code', 'Code'], ['name', 'Employee'], ['type', 'Leave type'], ['entitled', 'Entitled', 'dec'], ['carried', 'Carried', 'dec'],
            ['taken', 'Taken', 'dec'], ['pending', 'Pending', 'dec'], ['balance', 'Balance', 'dec'],
        ], $rows, null, null, ['label' => (string) $year, 'note' => 'Unlimited types show no entitlement or balance.']);
    }
}
