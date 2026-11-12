<?php

namespace Database\Seeders;

use App\Models\LeaveType;
use Illuminate\Database\Seeder;

class LeaveTypeSeeder extends Seeder
{
    /** name, annual_quota, is_paid, carry_forward, allows_half_day, carry_forward_cap, allowed_on_probation, encashable */
    public const TYPES = [
        ['Annual leave', 14, true, true, true, 7, false, false],
        ['Sick leave', 10, true, false, true, null, true, false],
        ['Casual leave', 8, true, false, true, null, true, false],
        ['Unpaid leave', 0, false, false, true, null, true, false],
    ];

    public function run(): void
    {
        foreach (self::TYPES as [$name, $quota, $paid, $carry, $half, $cap, $probation, $encash]) {
            LeaveType::firstOrCreate(['name' => $name], [
                'annual_quota' => $quota, 'is_paid' => $paid, 'carry_forward' => $carry, 'allows_half_day' => $half,
                'carry_forward_cap' => $cap, 'allowed_on_probation' => $probation, 'encashable' => $encash,
            ]);
        }
    }
}
