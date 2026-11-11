<?php

namespace App\Domain\Leave\Support;

use App\Http\Resources\LeaveBalanceResource;
use App\Http\Resources\LeaveTypeResource;
use App\Models\Employee;
use App\Models\LeaveBalance;
use App\Models\LeaveType;

/** Prop shaping shared by the leave controllers. */
final class Shape
{
    /** @return list<array<string,mixed>> */
    public static function types(): array
    {
        return LeaveTypeResource::collection(LeaveType::orderBy('created_at')->orderBy('name')->get())->resolve();
    }

    /** @param array{balance: LeaveBalance, type: LeaveType, unlimited: bool, available: float|null} $row */
    public static function balance(array $row): array
    {
        return [
            ...LeaveBalanceResource::make($row['balance'])->resolve(),
            'unlimited' => $row['unlimited'],
            'available' => $row['available'],
        ];
    }

    /** Names for lists: id, name, designation, team_id. */
    public static function people(iterable $employeeIds = []): array
    {
        $q = Employee::query()->select(['id', 'name', 'designation', 'team_id']);
        $ids = collect($employeeIds)->unique()->values();

        return ($ids->isEmpty() ? $q : $q->whereIn('id', $ids))
            ->orderBy('name')->get()->map(fn ($e) => $e->only(['id', 'name', 'designation', 'team_id']))->all();
    }
}
