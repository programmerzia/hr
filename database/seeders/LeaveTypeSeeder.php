<?php

namespace Database\Seeders;

use App\Models\LeaveType;
use Illuminate\Database\Seeder;

class LeaveTypeSeeder extends Seeder
{
    /** name, annual_quota, is_paid, carry_forward, allows_half_day */
    public const TYPES = [
        ['Annual leave', 14, true, true, true],
        ['Sick leave', 10, true, false, true],
        ['Casual leave', 8, true, false, true],
        ['Unpaid leave', 0, false, false, true],
    ];

    public function run(): void
    {
        foreach (self::TYPES as [$name, $quota, $paid, $carry, $half]) {
            LeaveType::firstOrCreate(['name' => $name], [
                'annual_quota' => $quota, 'is_paid' => $paid, 'carry_forward' => $carry, 'allows_half_day' => $half,
            ]);
        }
    }
}
