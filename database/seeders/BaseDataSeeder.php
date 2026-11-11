<?php

namespace Database\Seeders;

use App\Models\AttendancePolicy;
use App\Models\Holiday;
use Illuminate\Database\Seeder;

/** Policy and public holidays; shared by demo and production. */
class BaseDataSeeder extends Seeder
{
    public const HOLIDAYS = [
        ['2026-02-21', 'International Mother Language Day'],
        ['2026-03-26', 'Independence Day'],
        ['2026-12-16', 'Victory Day'],
        ['2026-12-25', 'Christmas Day'],
    ];

    public function run(): void
    {
        if (! AttendancePolicy::query()->exists()) {
            AttendancePolicy::create(AttendancePolicy::DEFAULTS);
        }
        foreach (self::HOLIDAYS as [$date, $name]) {
            Holiday::firstOrCreate(['date' => $date], ['name' => $name]);
        }
        $this->call(LeaveTypeSeeder::class);
    }
}
